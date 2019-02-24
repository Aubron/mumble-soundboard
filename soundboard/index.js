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
const cacheControl = require('express-cache-controller')
const fetch = require('node-fetch')
const bodyParser = require('body-parser');

const app = express()
app.use(fileUpload())
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())
app.use(cacheControl({
    noCache: true
}))
const port = process.env.PORT || 3000;

let debug = false;


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

    // suppress slack events so that they don't spam on connect/disconnect
    console.log('suppressing slack events');
    debug = true;
    setTimeout(() => { debug = false; console.log('unsupressing slack events.') }, 10000)

    mumble.connect( process.env.MUMBLE_URL, options, function( error, client ) {
        if( error ) { throw new Error( error ); }
    
        client.authenticate(process.env.MUMBLE_USERNAME);
        client.on( 'initialized', function() {
            const mixer = new AudioMixer.Mixer({
                channels: 2,
                sampleRate: 44100,
                volume: 2,
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
            app.route('/api/sounds')
                .get(controllers.getSounds)
            app.route('/api/sound')
                .post(controllers.playSound(mixer))
                .put(controllers.uploadSound)
                .patch(controllers.renameSound)
                .delete(controllers.deleteSound)
            if(process.env.SLACK_WEBHOOK) {
                app.route('/api/message')
                    .post(controllers.sendMessage(client))
            }
        });

        if (process.env.SLACK_WEBHOOK) {
            console.log('Slack Integration Enabled')
            // Disconnect events
            client.on( 'protocol-in', function (data) {
                if (data.handler === 'userRemove') {
                    let user = sessions[data.message.session];
                    slackMessage(user.name, '_Disconnected_')
                }
            });
            // Collect user information
            var sessions = {};

            client.on( 'userState', function (state) {
                var user = sessions[state.actor];
                if (sessions[state.session]) {
                    if (state.channel_id && state.channel_id !== sessions[state.session].channel_id) {
                        // don't actually want that data. It's an option though!
                        //slackMessage(user.name, `_Moved from ${channels[sessions[state.session].channel_id].name} to ${channels[state.channel_id].name}_`)
                    }
                    if (
                        (state.self_mute !== null && state.self_mute !== sessions[state.session].self_mute)
                    ) {
                        slackMessage(user.name, state.self_mute ? '_Muted_' : '_Unmuted_')
                    }
                    if (
                        (state.self_deaf !== null && state.self_deaf !== sessions[state.session].self_deaf)
                    ) {
                        slackMessage(user.name, state.self_deaf ? '_Deafened_' : '_Undeafened_')
                    }
                    
                } else {
                    sessions[state.session] = state;
                    if(state.name) {
                        slackMessage(state.name, '_Connected_')
                    }
                }

                Object.keys(state).forEach((key) => {
                    let value = state[key];
                    if (value !== null) {
                        sessions[state.session][key] = value;
                    }
                })
            });

            // Collect channel information
            var channels = {};
            client.on( 'channelState', function (state) {
                channels[state.channel_id] = state;
            });

            // On text message...
            client.on( 'textMessage', function (data) {
                var user = sessions[data.actor];
                slackMessage(user.name, data.message);
            });
        }

        
    });
}

const slackMessage = (username, message) => {
    if (debug === false) {
        fetch(process.env.SLACK_WEBHOOK, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username,
                text: message
            })
        });
    } else {
        console.log('message supressed due to debug flag')
    }
    
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
    })
}


if (process.env.NODE_ENV === 'production') {
    updateRoute53();
}

connect();



