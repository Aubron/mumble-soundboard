const mumble = require('./mumble');

module.exports = {
    playSound: (mixer) => ((req,res) => {
        mumble.playLocalSound(mixer,'./didntwork.mp3');
        res.send('success');
    }),
    playRemoteSound: (mixer) => ((req,res) => {
        mumble.playBucketSound(mixer, req.body.file);
        res.send('success');
    })
}