#include <pjsua-lib/pjsua.h>
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

    pjsua_acc_id acc_id;
    pj_status_t status = pjsua_acc_add(&cfg, PJ_FALSE, &acc_id);
    if (status != PJ_SUCCESS) {
        *out_acc_id = -1;
        return (int)status;
    }

    status = pjsua_acc_set_registration(acc_id, PJ_TRUE);
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
    const char *call_uri = uri;

    if (strstr(uri, "sip:") == NULL && strchr(uri, '@') == NULL) {
        pjsua_acc_info info;
        if (pjsua_acc_get_info((pjsua_acc_id)acc_id, &info) == PJ_SUCCESS) {
            int domain_len = info.acc_uri.slen;
            const char *at = memchr(info.acc_uri.ptr, '@', info.acc_uri.slen);
            if (at) {
                domain_len = (info.acc_uri.ptr + info.acc_uri.slen) - at;
            }
            int n = snprintf(buf, sizeof(buf), "sip:%s%.*s", uri, (int)domain_len,
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
    pj_status_t status = pjsua_call_hangup(
        (pjsua_call_id)call_id, 0, NULL, NULL);
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
    pj_str_t dst;
    dst.ptr = (char *)target;
    dst.slen = strlen(target);
    pj_status_t status = pjsua_call_xfer(
        (pjsua_call_id)call_id, &dst, NULL);
    return (status == PJ_SUCCESS) ? 0 : (int)status;
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
        rust_on_call_state((int)call_id, info.state);
    }
}

static void c_on_incoming_call(pjsua_acc_id acc_id,
                                pjsua_call_id call_id,
                                pjsip_rx_data *rdata)
{
    (void)rdata;
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
