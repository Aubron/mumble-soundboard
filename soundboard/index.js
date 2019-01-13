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

    client.authenticate('Soundboard');
    client.on( 'initialized', function() {
        const mixer = new AudioMixer.Mixer({
            channels: 2,
            sampleRate: 44100,
            clearInterval: 150,
            volume: 2,
        });
        var input = client.inputStream({
            channels: 2,
            sampleRate: 44100,
        });
        mixer.pipe(input);

        // start the webserver
        app.listen(port);
        app.use(express.json())
        app.route('/play')
            .post(controllers.playSound(mixer))
        
        app.route('/playremote')
            .post(controllers.playRemoteSound(mixer))
    });
});
