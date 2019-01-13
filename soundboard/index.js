require('dotenv').config()

const mumble = require('mumble');
const express = require('express');
const fileUpload = require('express-fileupload');
const controllers = require('./controller.js');
const AudioMixer = require('audio-mixer');
const S3 = require('aws-sdk/clients/s3')

const app = express()
app.use(fileUpload())
app.use(express.json())
const port = process.env.PORT || 3000;


const connect = async () => {
    // get the key and cert from s3 for easy config
    let s3 = new S3();
    let key = await s3.getObject({Bucket: process.env.S3_BUCKET, Key: 'key.pem',}).promise()
    let cert = await s3.getObject({Bucket: process.env.S3_BUCKET, Key: 'cert.pem',}).promise()
    
    var options = {
        key: key.Body,
        cert: cert.Body
    };

    mumble.connect( process.env.MUMBLE_URL, options, function( error, client ) {
        if( error ) { throw new Error( error ); }
    
        client.authenticate(process.env.MUMBLE_USERNAME);
        client.on( 'initialized', function() {
            const mixer = new AudioMixer.Mixer({
                channels: 2,
                sampleRate: 44100,
                volume: 2,
            });
            var input = client.inputStream({
                channels: 2,
                sampleRate: 44100,
            });
            mixer.pipe(input);
    
            // start the webserver
            app.listen(port);
            app.route('/play')
                .post(controllers.playSound(mixer))
            app.route('/sounds')
                .get(controllers.getSounds)
            app.route('/sound')
                .put(controllers.uploadSound)
                .post(controllers.renameSound)
                .delete(controllers.deleteSound)
        });
    });
}

connect();



