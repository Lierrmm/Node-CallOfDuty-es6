import axios from 'axios';
import uniqid from 'uniqid';
import rateLimit from 'axios-rate-limit';
import cors_proxy from './cors.js';
import util from "util";
import crypto from 'crypto';

const userAgent = "Node/1.0.27";
let baseCookie = "new_SiteId=cod; ACT_SSO_LOCALE=en_US;country=US;XSRF-TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;API_CSRF_TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;";
let ssoCookie;
let loggedIn = false;
let useCORS = 0;
let debug = 0;
let defaultPlatform;

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
const defaultCORs = "http://localhost:1337/";
const infiniteWarfare = "iw";
const worldWar2 = "wwii";
const blackops3 = "bo3";
const blackops4 = "bo4";
const modernwarfare = "mw";


let platforms = {
    battle: "battle",
    steam: "steam", 
    psn: "psn", 
    xbl: "xbl",
    acti: "uno",
    uno: "uno"
};

class api {
    constructor(platform = "psn", _useCORS = 1, _debug = 0, ratelimit = {}) {
        defaultPlatform = platform;
        if(_useCORS === 1) {
            useCORS = 1;
            defaultBaseURL = `${defaultCORs}${defaultBaseURL}`;
            loginURL = `${defaultCORs}${loginURL}`;
            defaultProfileURL = `${defaultCORs}${defaultProfileURL}`;
            cors_proxy({
                originWhitelist: [],
                requireHeader: ['origin', 'x-requested-with']
            }).listen("1337", "0.0.0.0");
        }
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
    }

    cleanClientName(gamertag) {
        return encodeURIComponent(gamertag);
    }

    login(email, password) {
        return new Promise((resolve, reject) => {
            let randomId = uniqid();
            let md5sum = crypto.createHash('md5');
            let deviceId = md5sum.update(randomId).digest('hex');
            this.postReq(`${loginURL}registerDevice`, { 
                'deviceId': deviceId
            }).then((response) => {
                let authHeader = response.data.authHeader;
                apiAxios.defaults.headers.common.Authorization = `bearer ${authHeader}`;
                apiAxios.defaults.headers.common.x_cod_device_id = `${deviceId}`;
                this.postReq(`${loginURL}login`, { "email": email, "password": password }).then((data) => {
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
    
    //#region modernwarfare
     MWleaderboard(page, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            this.sendRequest(defaultBaseURL + util.format("leaderboards/v2/title/%s/platform/%s/time/alltime/type/core/mode/career/page/%s", modernwarfare, platform, page))
                .then(data => resolve(data))
                .catch(e => reject(e));
        });
    }

    MWcombatmp (gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("crm/cod/v2/title/%s/platform/%s/gamer/%s/matches/mp/start/0/end/0/details", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWcombatwz(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("crm/cod/v2/title/%s/platform/%s/gamer/%s/matches/wz/start/0/end/0/details", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatmp(gamertag, platform = defaultPlatform) {
        //https://my.callofduty.com/api/papi-client/crm/cod/v2/title/mw/platform/battle/gamer/lierrmm%232364/matches/mp/start/0/end/0
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("crm/cod/v2/title/%s/platform/%s/gamer/%s/matches/mp/start/0/end/0", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWfullcombatwz(gamertag, platform = defaultPlatform) {
        //https://my.callofduty.com/api/papi-client/crm/cod/v2/title/mw/platform/battle/gamer/lierrmm%232364/matches/mp/start/0/end/0
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("crm/cod/v2/title/%s/platform/%s/gamer/%s/matches/wz/start/0/end/0", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWmp(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("stats/cod/v1/title/%s/platform/%s/gamer/%s/profile/type/mp", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWwz(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            brDetails = [];
            brDetails.br = {};
            brDetails.br_dmz = {};
            brDetails.br_all = {};
            this.MWmp(gamertag, platform).then((data) => {
                if(typeof data.lifetime !== "undefined") {
                    if(typeof data.lifetime.mode.br !== "undefined") { data.lifetime.mode.br.properties.title = "br"; brDetails.br = data.lifetime.mode.br.properties; }
                    if(typeof data.lifetime.mode.br_dmz !== "undefined") { data.lifetime.mode.br_dmz.properties.title = "br_dmz"; brDetails.br_dmz = data.lifetime.mode.br_dmz.properties; }
                    if(typeof data.lifetime.mode.br_all !== "undefined") { data.lifetime.mode.br_all.properties.title = "br_all"; brDetails.br_all = data.lifetime.mode.br_all.properties; }
                }
                resolve(brDetails);
            }).catch(e => reject(e));
        });
    }

    MWfriends(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle") reject(`Battlenet friends are not supported. Try a different platform.`);
            if (platform === "uno") gamertag = this.cleanClientName(gamertag);
            console.log("Will only work for the account you are logged in as");
            const urlInput = defaultBaseURL + util.format('stats/cod/v1/title/%s/platform/%s/gamer/%s/profile/friends/type/mp', modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWstats(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("stats/cod/v1/title/%s/platform/%s/gamer/%s/profile/type/mp", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWwzstats(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform === "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("stats/cod/v1/title/%s/platform/%s/gamer/%s/profile/type/wz", modernwarfare, platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    /**
     * TODO: Make this a nicer function
     */
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
            if (platform === "battle" || platform == "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("loot/title/mw/platform/%s/gamer/%s/status/en", platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWAnalysis(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "steam") reject("Steam Doesn't exist for MW. Try `battle` instead.");
            if (platform === "battle" || platform == "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("ce/v2/title/mw/platform/%s/gametype/all/gamer/%s/summary/match_analysis/contentType/full/end/0/matchAnalysis/mobile/en", platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    MWMapList(platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            var urlInput = defaultBaseURL + util.format("ce/v1/title/mw/platform/%s/gameType/mp/communityMapData/availability", platform);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    friendFeed(gamertag, platform = defaultPlatform) {
        return new Promise((resolve, reject) => {
            if (platform === "battle" || platform == "uno") gamertag = this.cleanClientName(gamertag);
            var urlInput = defaultBaseURL + util.format("userfeed/v1/friendFeed/platform/%s/gamer/%s/friendFeedEvents/en", platform, gamertag);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getEventFeed() {
        return new Promise((resolve, reject) => {
            var urlInput = defaultBaseURL + util.format(`userfeed/v1/friendFeed/rendered/en/${ssoCookie}`);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getLoggedInIdentities() {
        return new Promise((resolve, reject) => {
            var urlInput = defaultBaseURL + util.format(`crm/cod/v2/identities/${ssoCookie}`);
            this.sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }

    getLoggedInUserInfo() {
        return new Promise((resolve, reject) => {
            var urlInput = defaultProfileURL + util.format(`cod/userInfo/${ssoCookie}`);
            this.sendRequestUserInfoOnly(urlInput).then(data => resolve(data)).catch(e => reject(e));
        });
    }
    //#endregion
    sendRequestUserInfoOnly(url) {
        return new Promise((resolve, reject) => {
            if (!loggedIn) reject("Not Logged In.");
            apiAxios.get(url).then(body => {
                if (debug === 1) {
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
    
    postRequest(url) {
        return new Promise((resolve, reject) => {
            if(!loggedIn) reject("Not Logged In.");
            url = "https://my.callofduty.com/api/papi-client/codfriends/v1/invite/battle/gamer/Leafized%231482?context=web";
            apiAxios.post(url, JSON.stringify({})).then(body => {
                if(debug === 1) {
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

export { api, platforms };