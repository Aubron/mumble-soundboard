const AudioMixer = require('audio-mixer');
const StreamThrottle = require('stream-throttle');
const S3 = require('aws-sdk/clients/s3');
const wav = require('wav');

const playStream = (mixer,stream) => {
    // read file
    var reader = new wav.Reader();
    
    // wait til we get format information before we play
    reader.on( 'format', (format) => {
        console.log(format);
        // add the mixer to the input
        let input = mixer.input({
            ...format,
            volume: 12
        })

        //pipe the decoded content through the throttler to the mixer input
        let throttler = new StreamThrottle.Throttle({rate: format.byteRate})
        console.log(format.byteRate);
        reader.pipe(throttler).pipe(input)

        //remove the input when we're done
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