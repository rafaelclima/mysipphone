#include <pjsua-lib/pjsua.h>
#include <pjsip/sip_transport_tls.h>
#include <string.h>

int mysip_account_add(const char *id,
                      const char *reg_uri,
                      const char *realm,
                      const char *username,
                      const char *password,
                      int *out_acc_id)
{
    pjsua_acc_config cfg;
    pjsua_acc_config_default(&cfg);
    cfg.id = pj_str((char *)id);
    cfg.reg_uri = pj_str((char *)reg_uri);
    cfg.cred_count = 1;
    cfg.cred_info[0].realm = pj_str((char *)realm);
    cfg.cred_info[0].scheme = pj_str("Digest");
    cfg.cred_info[0].username = pj_str((char *)username);
    cfg.cred_info[0].data_type = PJSIP_CRED_DATA_PLAIN_PASSWD;
    cfg.cred_info[0].data = pj_str((char *)password);
    cfg.register_on_acc_add = PJ_TRUE;

    pjsua_acc_id acc_id;
    pj_status_t status = pjsua_acc_add(&cfg, PJ_FALSE, &acc_id);
    if (status != PJ_SUCCESS) {
        *out_acc_id = -1;
        return (int)status;
    }

    *out_acc_id = (int)acc_id;
    return 0;
}

int mysip_make_call(int acc_id, const char *uri, int *out_call_id)
{
    pj_str_t dst;
    char buf[512];
    char work_buf[512];
    const char *call_uri = uri;
    size_t uri_len = strlen(uri);

    // Work on a mutable copy
    if (uri_len >= sizeof(work_buf)) return -1;
    memcpy(work_buf, uri, uri_len + 1);

    // Decode %23 → # in the SIP user part (between "sip:" and "@").
    // Frontend encodes # as %23 for pjsip URI parser, but we need to
    // strip trailing # for Asterisk feature code compatibility.
    {
        const char *sip_pfx = strstr(work_buf, "sip:");
        char *at_sign = strchr(work_buf, '@');
        if (sip_pfx && at_sign) {
            char *user_start = work_buf + (sip_pfx - work_buf) + 4;
            size_t user_len = (size_t)(at_sign - user_start);
            // Decode %23 → #
            for (size_t i = 0; i + 2 < user_len; i++) {
                if (user_start[i] == '%' && user_start[i+1] == '2' && user_start[i+2] == '3') {
                    user_start[i] = '#';
                    size_t after = uri_len - (size_t)(user_start - work_buf + i + 3) + 1;
                    if (after > sizeof(work_buf)) {
                        after = 0;
                    }
                    memmove(&user_start[i+1], &user_start[i+3], after);
                    uri_len -= 2;
                    user_len -= 2;
                }
            }
            // Strip trailing # from user part (Asterisk dial terminator)
            if (user_len > 0 && user_start[user_len - 1] == '#') {
                memmove(&user_start[user_len - 1], &user_start[user_len],
                        uri_len - (size_t)(user_start - work_buf + user_len) + 1);
                uri_len--;
                user_len--;
            }
        }
    }
    call_uri = work_buf;

    if (strstr(call_uri, "sip:") == NULL && strchr(call_uri, '@') == NULL) {
        pjsua_acc_info info;
        if (pjsua_acc_get_info((pjsua_acc_id)acc_id, &info) == PJ_SUCCESS) {
            int domain_len = info.acc_uri.slen;
            const char *at = memchr(info.acc_uri.ptr, '@', info.acc_uri.slen);
            if (at) {
                domain_len = (info.acc_uri.ptr + info.acc_uri.slen) - at;
            }
            int n = snprintf(buf, sizeof(buf), "sip:%s%.*s", call_uri, (int)domain_len,
                            at ? at : info.acc_uri.ptr);
            if (n > 0 && n < (int)sizeof(buf)) {
                call_uri = buf;
            }
        }
    }

    dst.ptr = (char *)call_uri;
    dst.slen = strlen(call_uri);

    pjsua_call_id call_id;
    pj_status_t status = pjsua_call_make_call(
        (pjsua_acc_id)acc_id, &dst, NULL, NULL, NULL, &call_id);
    if (status != PJ_SUCCESS) {
        *out_call_id = -1;
        return (int)status;
    }
    *out_call_id = (int)call_id;
    return 0;
}

int mysip_call_hangup(int call_id)
{
    pjsua_call_info info;
    pj_status_t ret = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (ret != PJ_SUCCESS) return (int)ret;
    if (info.state >= PJSIP_INV_STATE_DISCONNECTED) {
        return 0; // already disconnected, treat as success
    }
    pj_status_t status = pjsua_call_hangup(
        (pjsua_call_id)call_id, 0, NULL, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_answer(int call_id, int code)
{
    pj_status_t status = pjsua_call_answer(
        (pjsua_call_id)call_id, code, NULL, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_set_hold(int call_id)
{
    pj_status_t status = pjsua_call_set_hold(
        (pjsua_call_id)call_id, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_unhold(int call_id)
{
    pjsua_call_setting opt;
    pjsua_call_setting_default(&opt);
    opt.flag = PJSUA_CALL_UNHOLD;
    pj_status_t status = pjsua_call_reinvite2(
        (pjsua_call_id)call_id, &opt, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_dial_dtmf(int call_id, const char *digits)
{
    pj_str_t dtmf;
    dtmf.ptr = (char *)digits;
    dtmf.slen = strlen(digits);
    pj_status_t status = pjsua_call_dial_dtmf(
        (pjsua_call_id)call_id, &dtmf);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_xfer(int call_id, const char *target)
{
    char buf[512];
    const char *xfer_uri = target;

    if (strstr(target, "sip:") == NULL && strchr(target, '@') == NULL) {
        pjsua_call_info ci;
        if (pjsua_call_get_info((pjsua_call_id)call_id, &ci) == PJ_SUCCESS) {
            pjsua_acc_info ai;
            if (pjsua_acc_get_info(ci.acc_id, &ai) == PJ_SUCCESS) {
                int domain_len = ai.acc_uri.slen;
                const char *at = memchr(ai.acc_uri.ptr, '@', ai.acc_uri.slen);
                if (at) {
                    domain_len = (ai.acc_uri.ptr + ai.acc_uri.slen) - at;
                }
                int n = snprintf(buf, sizeof(buf), "sip:%s%.*s",
                                target, (int)domain_len,
                                at ? at : ai.acc_uri.ptr);
                if (n > 0 && n < (int)sizeof(buf)) {
                    xfer_uri = buf;
                }
            }
        }
    }

    pj_str_t dst;
    dst.ptr = (char *)xfer_uri;
    dst.slen = strlen(xfer_uri);
    pj_status_t status = pjsua_call_xfer(
        (pjsua_call_id)call_id, &dst, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_call_get_remote_uri(int call_id, char *buf, int buf_size)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return (int)status;
    int len = info.remote_info.slen;
    if (len >= buf_size) len = buf_size - 1;
    memcpy(buf, info.remote_info.ptr, len);
    buf[len] = '\0';
    return 0;
}

int mysip_call_get_duration(int call_id, unsigned int *sec)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return (int)status;
    *sec = info.total_duration.sec;
    return 0;
}

int mysip_call_is_incoming(int call_id)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return -1;
    return (info.role == PJSIP_ROLE_UAS) ? 1 : 0;
}

int mysip_reg_info_get_code(pjsua_reg_info *info)
{
    if (!info || !info->cbparam) return -1;
    return info->cbparam->code;
}

int mysip_call_get_last_status(int call_id)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return -1;
    return (int)info.last_status;
}

int mysip_call_connect_media(int call_id)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return (int)status;
    if (info.media_status != PJSUA_CALL_MEDIA_ACTIVE) return 1;
    status = pjsua_conf_connect(info.conf_slot, 0);
    if (status != PJ_SUCCESS) return (int)status;
    status = pjsua_conf_connect(0, info.conf_slot);
    if (status != PJ_SUCCESS) return (int)status;
    return 0;
}

// ── Callback bridge (C → Rust) ──────────────────────────────────

// Rust-implemented callback forward declarations
extern void rust_on_call_state(int call_id, int state);
extern void rust_on_incoming_call(int acc_id, int call_id);
extern void rust_on_call_media_state(int call_id);
extern void rust_on_reg_state2(int acc_id, pjsua_reg_info *info);

// C bridge functions matching exact pjsua_callback struct layout
static void c_on_call_state(pjsua_call_id call_id, pjsip_event *e)
{
    (void)e;
    pjsua_call_info info;
    if (pjsua_call_get_info(call_id, &info) == PJ_SUCCESS) {
        fprintf(stderr, "[c_on_call_state] call_id=%d state=%d\n", (int)call_id, info.state);
        rust_on_call_state((int)call_id, info.state);
    }
}

static void c_on_incoming_call(pjsua_acc_id acc_id,
                                pjsua_call_id call_id,
                                pjsip_rx_data *rdata)
{
    (void)rdata;
    fprintf(stderr, "[c_on_incoming_call] acc_id=%d call_id=%d\n", (int)acc_id, (int)call_id);
    rust_on_incoming_call((int)acc_id, (int)call_id);
}

static void c_on_call_media_state(pjsua_call_id call_id)
{
    rust_on_call_media_state((int)call_id);
}

static void c_on_reg_state2(pjsua_acc_id acc_id, pjsua_reg_info *info)
{
    rust_on_reg_state2((int)acc_id, info);
}

int mysip_init_callbacks(pjsua_config *cfg)
{
    pjsua_config_default(cfg);
    cfg->cb.on_call_state = c_on_call_state;
    cfg->cb.on_incoming_call = c_on_incoming_call;
    cfg->cb.on_call_media_state = c_on_call_media_state;
    cfg->cb.on_reg_state2 = c_on_reg_state2;
    return 0;
}

void mysip_apply_settings(pjsua_config *cfg,
                           pjsua_logging_config *log_cfg,
                           pjsua_media_config *media_cfg)
{
    cfg->max_calls = 4;
    cfg->thread_cnt = 1;

    log_cfg->level = 4;
    log_cfg->console_level = 4;

    media_cfg->clock_rate = 8000;
    media_cfg->snd_clock_rate = 8000;
    media_cfg->channel_count = 2;
    media_cfg->audio_frame_ptime = 20;
    media_cfg->no_vad = PJ_TRUE;
    media_cfg->quality = 8;
    media_cfg->ec_tail_len = 0;
    media_cfg->enable_ice = PJ_FALSE;
    media_cfg->enable_turn = PJ_FALSE;
    media_cfg->thread_cnt = 1;

    pjsip_cfg()->endpt.allow_tx_hash_in_uri = PJ_TRUE;
}

int mysip_set_mic_mute(int call_id, int muted)
{
    pjsua_call_info info;
    pj_status_t status = pjsua_call_get_info((pjsua_call_id)call_id, &info);
    if (status != PJ_SUCCESS) return (int)status;
    if (muted) {
        status = pjsua_conf_disconnect(0, info.conf_slot);
    } else {
        status = pjsua_conf_connect(0, info.conf_slot);
    }
    return (int)status;
}

int mysip_call_xfer_replaces(int call_id,
                              int dest_call_id,
                              int options)
{
    pj_status_t status = pjsua_call_xfer_replaces(
        (pjsua_call_id)call_id,
        (pjsua_call_id)dest_call_id,
        options, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
}

int mysip_create_tls_transport(int port,
                               const char *cert_file,
                               const char *privkey_file,
                               const char *ca_file,
                               int *out_transport_id)
{
    pjsua_transport_config cfg;
    pjsua_transport_config_default(&cfg);
    cfg.port = (unsigned)port;

    pjsip_tls_setting_default(&cfg.tls_setting);

    if (cert_file && cert_file[0]) {
        cfg.tls_setting.cert_file = pj_str((char *)cert_file);
    }
    if (privkey_file && privkey_file[0]) {
        cfg.tls_setting.privkey_file = pj_str((char *)privkey_file);
    }
    if (ca_file && ca_file[0]) {
        cfg.tls_setting.ca_list_file = pj_str((char *)ca_file);
    }

    cfg.tls_setting.verify_server = PJ_TRUE;
    cfg.tls_setting.verify_client = PJ_FALSE;

    pjsua_transport_id tp_id = -1;
    pj_status_t status = pjsua_transport_create(
        PJSIP_TRANSPORT_TLS, &cfg, &tp_id);

    if (status != PJ_SUCCESS) {
        *out_transport_id = -1;
        return (int)status;
    }

    *out_transport_id = (int)tp_id;
    return 0;
}
