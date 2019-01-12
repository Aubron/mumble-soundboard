const lame = require('lame');
const fs = require('fs');
const AudioMixer = require('audio-mixer');

module.exports = {
    playLocalSound: (mixer,path) => {
        // read file locally
        var stream = fs.createReadStream( path );
        var decoder = new lame.Decoder();
        
        // wait til we get format information before we play
        decoder.on( 'format', (format) => {
            console.log(format);
            let input = new AudioMixer.Input({
                sampleRate: format.sampleRate,
                channels: format.channels,
                bitDepth: format.bitDepth,
                volume: 2,
            })
            mixer.addInput(input)
            decoder.pipe(input)
        });

        stream = stream.pipe( decoder );
    },
    playBucketSound: (client,key) => {

    }
}