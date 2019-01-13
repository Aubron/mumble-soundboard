const lame = require('lame');
const fs = require('fs');
const AudioMixer = require('audio-mixer');
const StreamThrottle = require('stream-throttle');
const S3 = require('aws-sdk/clients/s3')

const playStream = (mixer,stream) => {
    // read file locally
    var decoder = new lame.Decoder();
    
    // wait til we get format information before we play
    decoder.on( 'format', async (format) => {
        console.log(format);
        //create a standalone mixer
        let input = new AudioMixer.Input({
            sampleRate: format.sampleRate,
            channels: format.channels,
            bitDepth: format.bitDepth,
            volume: 100,
        })
        // add the mixer to the input
        mixer.addInput(input)
        // determine the rate
        let rate = format.sampleRate * format.channels * (format.bitDepth / 8)

        //pipe the decoded content through the throttler to the mixer input
        let throttler = new StreamThrottle.Throttle({rate})
        decoder.pipe(throttler).pipe(input)

        throttler.on('finish',() => {mixer.removeInput(input)})
    });

    stream.pipe( decoder );
}

module.exports = {
    playLocalSound: (mixer,path) => {
        // read file locally
        var stream = fs.createReadStream( path );
        playStream(mixer,stream);
    },
    playBucketSound: (mixer,path) => {
        var params = {
            Bucket: process.env.S3_BUCKET,
            Key: path,
        }
        console.log(params)
        let s3 = new S3();

        let stream = s3.getObject(params).createReadStream()
        playStream(mixer,stream);
    }
}