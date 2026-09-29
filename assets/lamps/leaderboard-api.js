(function (global) {
  "use strict";

  function apiUrl() {
    var config = global.LAMPS_CONFIG || {};
    var value = String(global.LAMPS_LEADERBOARD_API_URL || config.leaderboardApiUrl || "").trim().replace(/\/$/, "");
    return /^https?:\/\//i.test(value) ? value : "";
  }
  var pending = Object.create(null);
  var sequence = 0;

  function asObject(raw) {
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)); } catch (_) { return null; }
  }

  function nativeAvailable() {
    try {
      return !!(
        (global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.chatMessage) ||
        (global.androidBridge && typeof global.androidBridge.postMessage === "function")
      );
    } catch (_) { return false; }
  }

  function post(payload) {
    var text = JSON.stringify(payload);
    var ios = global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.chatMessage;
    if (ios) { ios.postMessage(text); return; }
    if (global.androidBridge && typeof global.androidBridge.postMessage === "function") { global.androidBridge.postMessage(text); return; }
    throw new Error("Bridge not available");
  }

  function decodeBody(value) {
    if (typeof value !== "string") return value;
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }

  function resolveNative(raw) {
    var msg = asObject(raw);
    if (!msg) return;
    var nested = asObject(msg.data) || asObject(msg.params) || msg.data || msg.params || msg;
    var callbackSig = String(msg.callbackName || msg.callbackSig || (nested && (nested.callbackName || nested.callbackSig)) || "");
    if (!callbackSig || !pending[callbackSig]) return;
    var item = pending[callbackSig]; delete pending[callbackSig];
    item.resolve({
      code: Number(msg.code != null ? msg.code : nested.code || 0),
      msg: msg.msg || nested.msg || "",
      data: nested.data && typeof nested.data === "object" ? {status:Number(nested.data.status) || 0, data:decodeBody(nested.data.data)} : nested.data,
    });
  }

  function hook(name, target) {
    if (!target || typeof target[name] !== "function" || target[name].__leaderboardHook) return;
    var previous = target[name];
    var wrapped = function () { resolveNative(arguments.length > 1 ? {callbackName:arguments[0], data:arguments[1]} : arguments[0]); return previous.apply(this, arguments); };
    wrapped.__leaderboardHook = true;
    try { target[name] = wrapped; } catch (_) {}
  }

  function request(data) {
    if (!nativeAvailable()) return Promise.reject(new Error("APP_REQUIRED"));
    var callbackSig = "leaderboard_" + Date.now() + "_" + (++sequence);
    return new Promise(function (resolve, reject) {
      pending[callbackSig] = {resolve:resolve, reject:reject};
      try { post({type:"request", id:callbackSig, method:"lamps.common.request", data:data, callbackSig:callbackSig}); }
      catch (error) { delete pending[callbackSig]; reject(error); }
      global.setTimeout(function () { if (pending[callbackSig]) { delete pending[callbackSig]; reject(new Error("TIMEOUT")); } }, 10000);
    });
  }

  hook("_handle_", global.HoorahBridge);
  hook("_handle_", global.HupuBridge);
  hook("receiveNativeMessage", global);

  function parseResult(result) {
    if (!result || Number(result.code) !== 0 || !result.data || Number(result.data.status) < 200 || Number(result.data.status) >= 300) throw new Error("REQUEST_FAILED");
    var body = result.data.data;
    if (typeof body === "string") body = JSON.parse(body);
    return body;
  }

  function submitScore(category, mode, value, player) {
    var API_URL = apiUrl();
    if (!API_URL) return Promise.resolve(false);
    var payload = {category:String(category || "classic"), mode:Number(mode), player:String(player || "匿名玩家")};
    if (payload.category === "endless") payload.streak = Math.max(0, Math.floor(Number(value) || 0));
    else payload.time = Math.max(1, Math.ceil(Number(value) || 0));
    return request({url:API_URL + "/scores", method:"post", data:payload, header:{"Content-Type":"application/json"}}).then(parseResult).then(function () { return true; }).catch(function () { return false; });
  }

  function fetchScores(category, mode) {
    var API_URL = apiUrl();
    if (!API_URL) return Promise.resolve(null);
    return request({url:API_URL + "/scores", method:"get", data:{category:String(category || "classic"), mode:Number(mode)}, header:{"Content-Type":"application/json"}}).then(parseResult).then(function (body) { return Array.isArray(body.scores) ? body.scores : []; }).catch(function () { return null; });
  }

  global.SpiderLeaderboard = {submitScore:submitScore, fetchScores:fetchScores};
})(typeof window !== "undefined" ? window : globalThis);
