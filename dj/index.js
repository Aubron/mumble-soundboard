require('dotenv').config()

var mumble = require('mumble');
const express = require('express');
const controllers = require('./controller.js');
const AudioMixer = require('audio-mixer');
const fs = require('fs');

const app = express()
const port = process.env.PORT || 3000;

var options = {
    key: fs.readFileSync( 'key.pem' ),
    cert: fs.readFileSync( 'cert.pem' )
};


mumble.connect( process.env.MUMBLE_URL, options, function( error, client ) {
    if( error ) { throw new Error( error ); }

    client.authenticate('DJ');
    client.on( 'initialized', function() {
        const mixer = new AudioMixer.Mixer({
            channels: 1,
            sampleRate: 48000,
            clearInterval: 3000,
        });
        var input = client.inputStream();
        mixer.pipe(input);

        // start the webserver
        app.listen(port);
        app.route('/play')
            .post(controllers.playSound(mixer))
    });
});
