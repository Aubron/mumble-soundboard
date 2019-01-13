const AudioMixer = require('audio-mixer');
const StreamThrottle = require('stream-throttle');
const S3 = require('aws-sdk/clients/s3');
const wav = require('wav');

const playStream = (mixer,stream) => {
    // read file
    var reader = new wav.Reader();
    
    // wait til we get format information before we play
    reader.on( 'format', (format) => {
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
        reader.pipe(throttler).pipe(input)

        throttler.on('finish',() => {mixer.removeInput(input)})
    });

    stream.pipe( reader );
}

module.exports = {
    playBucketSound: (mixer,path) => {
        var params = {
            Bucket: process.env.S3_BUCKET,
            Key: path + '.wav',
        }
        let s3 = new S3();

        let stream = s3.getObject(params).createReadStream()
        playStream(mixer,stream);
    }
}