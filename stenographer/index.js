require('dotenv').config()

const mumble = require('mumble');
const S3 = require('aws-sdk/clients/s3');
const SQS = require('aws-sdk/clients/sqs');
const fetch = require('node-fetch')
const wav = require('wav');
const uuid4 = require('uuid4');
const fs = require('fs');
const s3 = new S3();
const sqs = new SQS();

const queue = [];

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


    mumble.connect( process.env.MUMBLE_URL, options, function( error, client ) {
        if( error ) { throw new Error( error ); }
    
        client.authenticate(process.env.MUMBLE_USERNAME);
        var sessions = {};
        var streams = {};
        client.on( 'userState', function (state) {
            var user = client.userBySession(state.session || state.actor);
            if (!sessions[state.session]) {
                sessions[state.session] = state;
                streams[state.session] = user.outputStream(true);
                streams[state.session].on('data', () => {
                    let fileStream
                    // temp uuid for concurrency
                    if (streams[state.session].timeout) {
                        clearTimeout(streams[state.session].timeout);
                    } else {
                        streams[state.session].tmpName = uuid4();
                        if (streams[state.session].wavStream) {
                            streams[state.session].unpipe();
                            delete streams[state.session].wavStream
                        }
                        streams[state.session].wavStream = new wav.Writer({
                            "channels": 1,
                            "sampleRate": 48000,
                            "bitDepth": 16
                        });
                        // create a fs stream
                        streams[state.session].fileStream = fs.createWriteStream(`tmp/${streams[state.session].tmpName}.wav`);
                        streams[state.session].wavStream.pipe(streams[state.session].fileStream)
                        streams[state.session].pipe(streams[state.session].wavStream)
                    }
                    streams[state.session].timeout = setTimeout(async () => {
                        const sound = {
                            user: user.name,
                            filename: `${streams[state.session].tmpName}.wav`,
                            processed: false,
                            timestamp: Date.now()
                        }
                        //put the sound into the queue, for order and user tracking
                        queue.push(sound);
                        let data = fs.readFileSync(`tmp/${streams[state.session].tmpName}.wav`)
                        const params = {
                            Body: data,
                            Key: streams[state.session].tmpName + '.wav',
                            Bucket: process.env.STENOGRAPHER_BUCKET,
                            ACL: 'bucket-owner-full-control'
                        }
                        await s3.putObject(params).promise();
                        streams[state.session].fileStream.end();
                        console.log('unlinking file');
                        fs.unlinkSync(`tmp/${streams[state.session].tmpName}.wav`)
                        streams[state.session].timeout = null;
                    },500)
                });
                
            }
            Object.keys(state).forEach((key) => {
                let value = state[key];
                if (value !== null) {
                    sessions[state.session][key] = value;
                }
                sessions[state.session].registered = user.isRegistered;
            })
        });
    });

    var params = {
        QueueUrl: process.env.SQS_URL,
        WaitTimeSeconds: 20,
        MaxNumberOfMessages: 10,
    };
    const checkSqs = () => {
        sqs.receiveMessage(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                //console.log(data);
                if (data.Messages) {
                    console.log(data.Messages.length);
                    for(let i = 0; i < data.Messages.length; i+= 1) {
                        let message = JSON.parse(JSON.parse(data.Messages[i].Body).Message)
                        let key = message.Records[0].s3.object.key;
                        console.log(key);
                        let params = {
                            Bucket: process.env.STENOGRAPHER_BUCKET,
                            Key: key
                        }
                        s3.getObject(params, (err,data) => {
                            if (err) {
                                console.log("Fetch Error", err);
                            } else {
                                // find the element in the array that corresponds with the filename.
                                let originalKey = key.split("_")[0];
                                let soundDetails = queue.find((sound) => {
                                    return originalKey === sound.filename
                                })
                                if (soundDetails) {
                                    soundDetails.processed = true;
                                    soundDetails.text = JSON.parse(data.Body).results.transcripts[0].transcript
                                }
                                sendReleasedMessages();
                            }
                        })
                        var deleteParams = {
                            QueueUrl: process.env.SQS_URL,
                            ReceiptHandle: data.Messages[i].ReceiptHandle
                        };
                        sqs.deleteMessage(deleteParams, function(err, data) {
                            if (err) {
                                console.log("Delete Error", err);
                            } else {
                                console.log("Message Deleted", data);
                            }
                        });
                    }
                    
                }
            }
        });
    }
    setInterval(checkSqs, 20000)
    setInterval(clearOldMessages, 5000);
    checkSqs();
    
}

const slackMessage = (username, message) => {
    if (username.indexOf('Soundboard') === -1) {
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
    }
    
}

const clearOldMessages = () => {
    while(queue[0] && Date.now() - queue[0].timestamp > 180000) {
        console.log('clearing an expired message', queue[0]);
        queue.shift();
    }
    sendReleasedMessages();
}

const sendReleasedMessages = () => {
    while(queue[0] && queue[0].processed === true) {
        slackMessage(queue[0].user, queue[0].text);
        queue.shift();
    }
}

connect();