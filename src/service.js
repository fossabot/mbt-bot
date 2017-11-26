const config = require("./config.js");
const packageInfo = require("./package.json");
const log = require("log4js").getLogger();
const MessageApi = require("./modules/message-api.js");
const HostSvcApi = require("./modules/host-svc-api.js");

const messageApi = new MessageApi(config.message);
const hostSvcApi = new HostSvcApi(config.hostSvc);

messageApi.onText(/\/.+/, (message) => {
    const to = message.from;
    if (!messageApi.isOwner(to.id)) {
        messageApi.sendText(to, ";(", {});
        return;
    }
    switch (message.text) {
        case "/start" :
            messageApi.sendText(to, "Type " / " to show more commands");
            break;

        case "/stop" :
            messageApi.sendText(to, "Ok, see you later!");
            break;

        case "/photo" :
            messageApi.sendPhoto(to, hostSvcApi.getUrl() + "/system/camera.jpg", {});
            break;

        case "/screen" :
            messageApi.sendPhoto(to, hostSvcApi.getUrl() + "/system/screen.jpg", {});
            break;

        case "/system" :
            hostSvcApi.systemApi("info").then(
                body => {
                    const data = JSON.parse(body);
                    let info = [
                        "📈 " + (data.load.avgload * 100) + "% (" + data.process.reduce((last, row) =>
                            last + " " + row.command.split(" ")[0].split("/").slice(-1)[0], "").trim() + ")",
                        "🌡 " + data.sensors.main + " ℃/ " + data.sensors.outer + " ℃",
                        "📊 " + data.memory.active + " of " + data.memory.total,
                        "💾 " + data.storage[0].used + " of " + data.storage[0].size,
                        "🔮 " + data.network.rx + "/" + data.network.tx
                    ];
                    messageApi.sendText(to, info.join("\n"), {parse_mode: "HTML"});
                }
            ).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/net" :
            hostSvcApi.systemApi("net").then(
                body => {
                    const data = JSON.parse(body);
                    const text = data.reduce((last, current) => last + "\n" + current.ip + " " + (current.description !== "?" ? current.description : current.mac), "");
                    messageApi.sendText(to, text || "Nobody :(");
                }).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/services" :
            hostSvcApi.msaApi("list").then(
                body => {
                    JSON.parse(body).map(getMessageForItem).forEach(item =>
                        messageApi.sendText(to, item.text, {reply_markup: item.reply_markup}));
                }
            ).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/wakepc" :
            hostSvcApi.systemApi("wakePC").then(
                () => messageApi.sendText(to, "OK")
            ).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/waketv" :
            hostSvcApi.systemApi("wakeTV").then(
                () => messageApi.sendText(to, "OK")
            ).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/torrent" :
            torrentList(to);
            break;

        case "/tv28":
            messageApi.sendText(to, "-----==== Press any button ====-----",
                {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{
                                text: "🔇",
                                callback_data: "tv/lg28-pc/mute"
                            }, {
                                text: "🔴",
                                callback_data: "tv/lg28-pc/power-off"
                            }],
                            [{text: "🔊", callback_data: "tv/lg28-pc/volume-up"}, {
                                text: "🔼",
                                callback_data: "tv/lg28-pc/channel-up"
                            }],
                            [{text: "🔉", callback_data: "tv/lg28-pc/volume-down"}, {
                                text: "🔽",
                                callback_data: "tv/lg28-pc/channel-down"
                            }]
                        ]
                    })
                }).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
            break;

        case "/about" :
            messageApi.sendText(to, packageInfo.name + " " + packageInfo.version + "\n" + packageInfo.repository.url, {disable_web_page_preview: true});
            break;

        default:
            messageApi.sendText(to, ";(", {});
            break;
    }
});

messageApi.on("callback_query", message => {
        hostSvcApi.api(message.data).then(
            (body) => {
                if (message.data.startsWith("msa")) {
                    if (message.data.endsWith("logs")) {
                        messageApi.answerCallbackQuery({callback_query_id: message.id, text: "🆗"});
                        messageApi.sendText(message.from, "```" + body + "```", {parse_mode: "Markdown", disable_web_page_preview: true})
                    } else {
                        let item = JSON.parse(body).map(getMessageForItem)[0];
                        messageApi.editMessageText(item ? item.text : "[removed]", {
                            message_id: message.message.message_id,
                            chat_id: message.message.chat.id,
                            reply_markup: item ? item.reply_markup : null
                        });
                    }
                }
                if (message.data.startsWith("torrent")) {
                    messageApi.answerCallbackQuery({callback_query_id: message.id, text: "🆗"});
                    torrentList(message.from);
                } else {
                    messageApi.answerCallbackQuery({callback_query_id: message.id, text: "🆗"});
                }
            },
            err => messageApi.answerCallbackQuery({callback_query_id: message.id, text: "⛔️" + err.toString()})
        )
    }
);

messageApi.on("document", async message => {
    console.log(message);
    try {
        let url = await messageApi.getFileLink(message.document.file_id);
        await hostSvcApi.torrentApi("add?id=" + url);
        await messageApi.sendText(message.from, "OK. Type /torrent to see all");
    } catch (err) {
        log.error(err);
        messageApi.sendText(message.from, err.toString());

    }
});

log.info("Bot has started");
log.info("Please press [CTRL + C] to stop");

process.on("SIGINT", () => {
    log.info("Bot has stopped");
    process.exit(0);
});

process.on("SIGTERM", () => {
    log.info("Bot has stopped");
    process.exit(0);
});

function torrentList(to) {
    hostSvcApi.torrentApi("list").then(
        body => {
            JSON.parse(body).forEach(torrent =>
                messageApi.sendText(to, torrent.name + "\n" + (torrent.status === "done" ? torrent.sizeWhenDone : torrent.percentDone),
                    {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [{text: "🚾 remove", callback_data: "torrent/remove/" + torrent.id}]
                            ]
                        })
                    })
            );
        }
    ).catch(err => log.error(err) & messageApi.sendText(to, err.toString()));
}

function getMessageForItem(item) {
    const buttonNames = {
        "start": "▶️ Start",
        "stop": "⏹ Stop",
        "restart": "🔄 Reload",
        "remove": "🚾 Remove",
        "logs": "🗒 Logs",
        "update": "↗️ Update"
    };
    return {
        text: item.name + " " + (item.state === "running" ? "☀" : "🌩") + " [" + item.status.toLowerCase() + "]",
        reply_markup: JSON.stringify({
            inline_keyboard: [
                item.actions.map(action => {
                    return {
                        text: buttonNames[action.name],
                        callback_data: "msa/" + action.url
                    }
                })
            ]
        })
    }
}


