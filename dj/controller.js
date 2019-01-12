const mumble = require('./mumble');

module.exports = {
    playSound: (mixer) => ((req,res) => {
        mumble.playLocalSound(mixer,'./didntwork.mp3');
        res.send('tester');
    })
}