module.exports = {
    //handle: (ctx, message, sendMessage) => ctx.hostSvc.downloadPicture('/tv/screen', message.from)
    handle: (ctx, message) => {
        ctx.dao.loadUserData(message.from.id, (err, user) => {
            if (user.session != null) {
                ctx.sendMessage(ctx, message.from, 'Ваше сообщение:' + message.text);
            } else {
                user.session = 'tv';
                ctx.sendMessage(ctx, message.from, 'Выберите одну из следующих тем');
            }
        });
    }
};

function sendMessage(ctx, to, response) {
    ctx.bot.sendMessage(to, response,
        {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['🔊', '🔇', '🔉'],
                    ['◀️', '🔴', '▶️'],
                    ['⬅️ Отмена', '🏞']
                ],
                resize_keyboard: true
            }
        });
}

