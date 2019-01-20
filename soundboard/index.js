require('dotenv').config()

const mumble = require('mumble');
const express = require('express');
const fileUpload = require('express-fileupload');
const controllers = require('./controller.js');
const AudioMixer = require('audio-mixer');
const S3 = require('aws-sdk/clients/s3')
const Route53 = require('aws-sdk/clients/route53')
const request = require('request');
const cors = require('cors')

const app = express()
app.use(fileUpload())
app.use(express.json())
app.use(cors())
const port = process.env.PORT || 3000;


const connect = async () => {
    // get the key and cert from s3 for easy config
    let s3 = new S3();
    keyPrefix = process.env.KEY_PREFIX || '';
    let key = await s3.getObject({Bucket: process.env.S3_BUCKET, Key: `${keyPrefix}key.pem`,}).promise()
    let cert = await s3.getObject({Bucket: process.env.S3_BUCKET, Key: `${keyPrefix}cert.pem`,}).promise()
    
    var options = {
        key: key.Body,
        cert: cert.Body
    };

    
    console.log('initializing client');
    console.log('using keys', `${keyPrefix}key.pem`, `${keyPrefix}cert.pem`);
    console.log('and attempting to connect with username ',process.env.MUMBLE_USERNAME);
    console.log(key.Body);

    mumble.connect( process.env.MUMBLE_URL, options, function( error, client ) {
        if( error ) { throw new Error( error ); }
    
        client.authenticate(process.env.MUMBLE_USERNAME);
        client.on( 'initialized', function() {
            const mixer = new AudioMixer.Mixer({
                channels: 2,
                sampleRate: 44100,
                volume: 100,
                clearInterval: 150
            });
            var input = client.inputStream({
                channels: 2,
                sampleRate: 44100,
            });
            mixer.pipe(input);
    
            // start the webserver
            app.listen(port);
            app.route('/')
                .get(controllers.healthCheck)
            app.route('/sounds')
                .get(controllers.getSounds)
            app.route('/sound')
                .post(controllers.playSound(mixer))
                .put(controllers.uploadSound)
                .patch(controllers.renameSound)
                .delete(controllers.deleteSound)
        });
    });
}

const updateRoute53 = () => {
    let req = request({uri: 'http://checkip.amazonaws.com/'}, async (err,resp,body) => {
        let route53 = new Route53();
        let params ={
            ChangeBatch: {
                Changes: [
                    {
                        Action: "UPSERT",
                        ResourceRecordSet: {
                            Name: process.env.DOMAIN,
                            ResourceRecords: [{
                                Value: body
                            }],
                            Type: "A",
                            TTL: 60,
                        }
                    }
                ],
                Comment: "Automatic set DNS for soundboard api"
            },
            HostedZoneId: process.env.ROUTE53_HOSTED_ZONE
        }
        let test = await route53.changeResourceRecordSets(params).promise()
        console.log(body, params)
        console.log(test);
    })
}


if (process.env.NODE_ENV === 'production') {
    updateRoute53();
}

connect();



