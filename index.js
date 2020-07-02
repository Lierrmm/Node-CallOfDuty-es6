import axios from 'axios';
import uniqid from 'uniqid';
import rateLimit from 'axios-rate-limit';
import crypto from 'crypto';

const userAgent = "b8cf328b-664a-463b-9566-7c5cf966e4e9";
let baseCookie = "new_SiteId=cod; ACT_SSO_LOCALE=en_US;country=US;XSRF-TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;API_CSRF_TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;";
let ssoCookie;
let loggedIn = false;
let debug = 0;
let defaultPlatform;
let _helpers;

let apiAxios = axios.create({
    headers: {
      common: {
        "content-type": "application/json",
        "Cookie": baseCookie,
        "userAgent": userAgent,
        "x-requested-with": userAgent,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Connection": "keep-alive"
      },
    },
});

let loginAxios = apiAxios;

let defaultBaseURL = "https://my.callofduty.com/api/papi-client/";
let loginURL = "https://profile.callofduty.com/cod/mapp/";
let defaultProfileURL = "https://profile.callofduty.com/";

const modernwarfare = "mw";


let platforms = {
    battle: "battle",
    steam: "steam", 
    psn: "psn", 
    xbl: "xbl",
    acti: "uno",
    uno: "uno"
};

class helpers {
    buildUri(str) {
        return `${defaultBaseURL}${str}`;
    }

    buildProfileUri(str) {
        return `${defaultProfileURL}${str}`;
    }

    cleanClientName(gamertag) {
        return encodeURIComponent(gamertag);
    }

    sendRequestUserInfoOnly(url) {
        return new Promise((resolve, reject) => {
            if (!loggedIn) reject("Not Logged In.");
            apiAxios.get(url).then(body => {
                if (debug === 1) {
                    console.log(`[DEBUG]`, `Build URI: ${url}`);
                    console.log(`[DEBUG]`, `Round trip took: ${body.headers['request-duration']}ms.`);
                    console.log(`[DEBUG]`, `Response Size: ${JSON.stringify(body.data).length} bytes.`);
                }
                resolve(JSON.parse(body.data.replace(/^userInfo\(/, "").replace(/\);$/, "")));
            }).catch(err => reject(err));
        });
    }
    
    sendRequest(url) {
        return new Promise((resolve, reject) => {
            if(!loggedIn) reject("Not Logged In.");
            apiAxios.get(url).then(body => {
                if(debug === 1) {
                    console.log(`[DEBUG]`, `Build URI: ${url}`);
                    console.log(`[DEBUG]`, `Round trip took: ${body.headers['request-duration']}ms.`);
                    console.log(`[DEBUG]`, `Response Size: ${JSON.stringify(body.data.data).length} bytes.`);
                }
                if(typeof body.data.data.message !== "undefined" && body.data.data.message.includes("Not permitted"))
                    if(body.data.data.message.includes("user not found")) reject("user not found.");
                    else if(body.data.data.message.includes("rate limit exceeded")) reject("Rate Limited.");
                    else reject(body.data.data.message);
                resolve(body.data.data); 
            }).catch(err => reject(err));
        });
    }
    
    postReq(url, data, headers = null) {
        return new Promise((resolve, reject) => {
            loginAxios.post(url, data, headers).then(response => {
                response = response.data;
                resolve(response);
            }).catch((err) => {
                reject(err.message);
            });
        });
    }
}

class api {
    constructor(platform = "psn", _debug = 0, ratelimit = {}) {
        defaultPlatform = platform;
        if(_debug === 1) {
            debug = 1;
            apiAxios.interceptors.request.use((resp) => {
                resp.headers['request-startTime'] = process.hrtime();
                return resp;
            });
            apiAxios.interceptors.response.use((response) => {
                const start = response.config.headers['request-startTime'];
                const end = process.hrtime(start);
                const milliseconds = Math.round((end[0] * 1000) + (end[1] / 1000000));
                response.headers['request-duration'] = milliseconds;
                return response;
            });
        }
        try {
            apiAxios = rateLimit(apiAxios, ratelimit);
        } catch(Err) { console.log("Could not parse ratelimit object. ignoring."); }   
        _helpers = new helpers();      
    }

    

    login(email, password) {
        return new Promise((resolve, reject) => {
            let randomId = uniqid();
            let md5sum = crypto.createHash('md5');
            let deviceId = md5sum.update(randomId).digest('hex');
            _helpers.postReq(`${loginURL}registerDevice`, { 
                'deviceId': deviceId
            }).then((response) => {
                let authHeader = response.data.authHeader;
                apiAxios.defaults.headers.common.Authorization = `bearer ${authHeader}`;
                apiAxios.defaults.headers.common.x_cod_device_id = `${deviceId}`;
                _helpers.postReq(`${loginURL}login`, { "email": email, "password": password }).then((data) => {
                    if(!data.success) throw Error("Unsuccessful login.");
                    ssoCookie = data.s_ACT_SSO_COOKIE;
                    apiAxios.defaults.headers.common.Cookie = `${baseCookie}rtkn=${data.rtkn};ACT_SSO_COOKIE=${data.s_ACT_SSO_COOKIE};atkn=${data.atkn};`;
                    loggedIn = true;
                    resolve("Successful Login.");
                }).catch((err) => {
                    reject(err.message);
                });
            }).catch((err) => {
                reject(err.message);
            });  
        });
    }
    
     MWleaderboard(page, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            let urlInput = _helpers.buildUri(`leaderboards/v2/title/mw/platform/${platform}/time/alltime/type/core/mode/career/page/${page}`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWcombatmp (gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/mp/start/0/end/0/details`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWcombatmpdate (gamertag, start = 0, end = 0, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/mp/start/${start}/end/${end}/details`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWcombatwz(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/wz/start/0/end/0/details`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWcombatwzdate (gamertag, start = 0, end = 0, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/wz/start/${start}/end/${end}/details`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatmp(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/mp/start/0/end/0`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatmpdate (gamertag, start = 0, end = 0, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/mp/start/${start}/end/${end}`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatwz(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/wz/start/0/end/0`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatwzdate (gamertag, start = 0, end = 0, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/wz/start/${start}/end/${end}`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWmp(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/type/mp`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWwz(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/type/wz`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWBattleData(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            let brDetails = {};
            this.MWmp(gamertag, platform).then((data) => {
                let lifetime = data.lifetime;
                if (typeof lifetime !== "undefined") {
                    let filtered = Object.keys(lifetime.mode).filter(x => x.startsWith("br")).reduce((obj, key) => {
                        obj[key] = lifetime.mode[key];
                        return obj;
                    }, {});
                    if (typeof filtered.br !== "undefined") {
                        filtered.br.properties.title = "br";
                        brDetails.br = filtered.br.properties;
                    }
                    if (typeof filtered.br_dmz !== "undefined") {
                        filtered.br_dmz.properties.title = "br_dmz";
                        brDetails.br_dmz = filtered.br_dmz.properties;
                    }
                    if (typeof filtered.br_all !== "undefined") {
                        filtered.br_all.properties.title = "br_all";
                        brDetails.br_all = filtered.br_all.properties;
                    }
                }
                resolve(brDetails);
            }).catch(e => reject(e));
        });
    }

    MWfriends(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle") reject(`Battlenet friends are not supported. Try a different platform.`);
            if (platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            console.log("Will only work for the account you are logged in as");
            let urlInput = _helpers.buildUri(`stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/friends/type/mp`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWstats(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/type/mp`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWwzstats(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/type/wz`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWweeklystats(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            weeklyStats = [];
            weeklyStats.wz = {};
            weeklyStats.mp = {};
            this.MWstats(gamertag, platform).then((data) => {
                if (typeof data.weekly !== "undefined") weeklyStats.mp = data.weekly;
                this.MWwzstats(gamertag, platform).then((data) => {
                    if (typeof data.weekly !== "undefined") weeklyStats.wz = data.weekly;
                    resolve(weeklyStats);
                }).catch(e => reject(e));
            }).catch(e => reject(e));
        });
    }

    MWloot(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`loot/title/mw/platform/${platform}/gamer/${gamertag}/status/en`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWAnalysis(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`ce/v2/title/mw/platform/${platform}/gametype/all/gamer/${gamertag}/summary/match_analysis/contentType/full/end/0/matchAnalysis/mobile/en`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWMapList(platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            let urlInput = _helpers.buildUri(`ce/v1/title/mw/platform/${platform}/gameType/mp/communityMapData/availability`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    friendFeed(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "battle" || platform == "uno") gamertag = _helpers.cleanClientName(gamertag);
            let urlInput = _helpers.buildUri(`userfeed/v1/friendFeed/platform/${platform}/gamer/${gamertag}/friendFeedEvents/en`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getEventFeed() {
        return new Promise((resolve, reject) => {
            let urlInput = _helpers.buildUri(`userfeed/v1/friendFeed/rendered/en/${ssoCookie}`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getLoggedInIdentities() {
        return new Promise((resolve, reject) => {
            let urlInput = _helpers.buildUri(`crm/cod/v2/identities/${ssoCookie}`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getLoggedInUserInfo() {
        return new Promise((resolve, reject) => {
            let urlInput = _helpers.buildProfileUri(`cod/userInfo/${ssoCookie}`);
            _helpers.sendRequestUserInfoOnly(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    FuzzySearch(query, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "battle" || platform == "uno" || platform == "all") query = _helpers.cleanClientName(query);
            let urlInput = _helpers.buildUri(`crm/cod/v2/platform/${platform}/username/${query}/search`);
            _helpers.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }
}

export { api, platforms };