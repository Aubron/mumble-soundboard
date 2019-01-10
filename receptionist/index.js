require('dotenv').config()

var mumble = require('mumble');
const lame = require('lame');
const fs = require('fs');

mumble.connect( process.env.MUMBLE_URL, function( error, client ) {
    if( error ) { throw new Error( error ); }

    client.authenticate('Receptionist');
    client.on( 'initialized', function() {
        loop( client );
    });
});

var loop = function( client ) {
    var stream = play('loop.mp3',(format) => {

        var input = client.inputStream({
            channels: format.channels,
            sampleRate: format.sampleRate,
            gain: 0.25
        });
        var mumbleStream = stream.pipe(input);
        mumbleStream.on('finish', () => {
            loop(client);
        })
    });
};

var play = function( file, format ) {
    var stream = fs.createReadStream( file );

    var decoder = new lame.Decoder();

    if( format )
        decoder.on( 'format', format );
    stream = stream.pipe( decoder );
    return stream;
};