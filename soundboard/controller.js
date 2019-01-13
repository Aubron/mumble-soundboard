const mumble = require('./mumble');
const S3 = require('aws-sdk/clients/s3')
const lame = require('lame');
const wav = require('wav')
const Duplex = require('stream').Duplex;
const DynamoDB = require("aws-sdk/clients/dynamodb");
const uuid4 = require('uuid4');

const uploadSound = async (name,data) => {
    var dynamoDb = new DynamoDB({region: process.env.AWS_REGION});
    let uuid = uuid4()
    let dynamoParams = {
        Item: {
            id: {
                S: uuid,
            },
            name: {
                S: name,
            },
            playCount: {
                N: "0"
            }
        },
        TableName: process.env.DYNAMO_TABLE,
    };
    await dynamoDb.putItem(dynamoParams).promise();
    const s3 = new S3();
    const params = {
        Body: data,
        Key: uuid + '.wav',
        Bucket: process.env.S3_BUCKET,
    }
    await s3.putObject(params).promise();
    return uuid;
}

module.exports = {
    playSound: (mixer) => ((req,res) => {
        if (!req.body.file) {
            return res.status(400).send('No filename specified');
        }
        mumble.playBucketSound(mixer, req.body.file);
        return res.send('success');
    }),
    uploadSound: async (req,res) => {
        if (!req.files || !req.files.sound) {
            return res.status(400).send('No file specified.');
        }
        let data = req.files.sound.data;
        let name = req.files.sound.name.split('.').slice(0, -1).join('.')
        if (req.files.sound.mimetype === 'audio/mp3') {
            var decoder = new lame.Decoder();
            let stream = new Duplex();
            stream.push(data);
            stream.push(null);

            decoder.on( 'format', async (format) => {
                const writer = new wav.Writer(format);
                decoder.pipe(writer)
                const buffers = [];
                writer.on('data', (data) => buffers.push(data))
                writer.on('end', async () => {
                    let id = await uploadSound(name,Buffer.concat(buffers));
                    return res.send({id});
                })
            });

            stream.pipe( decoder );
        } else if (req.files.sound.mimetype === 'audio/wav') {
            let id = await uploadSound(name,data);
            return res.send({id});
        }
    },
    getSounds: async (req,res) => {
        var docClient = new DynamoDB.DocumentClient({region: process.env.AWS_REGION});
        let params = {
            TableName: process.env.DYNAMO_TABLE,
        }
        let scan = await docClient.scan(params).promise();
        return res.send(scan);
    },
    renameSound: async (req,res) => {
        if (!req.body || !req.body.id || !req.body.name) {
            return res.status(500).send('id and name required');
        }
        var dynamoDb = new DynamoDB({region: process.env.AWS_REGION});
        let params = {
            ExpressionAttributeNames: {
                "#N": "name"
            },
            ExpressionAttributeValues: {
                ":n": {
                    S: req.body.name
                }
            },
            TableName: process.env.DYNAMO_TABLE,
            Key: {
                "id": {
                    S: req.body.id
                }
            },
            UpdateExpression: "SET #N = :n"
        };
        let update = await dynamoDb.updateItem(params).promise()
        return res.send(update);
    },
    deleteSound: async (req,res) => {
        if (!req.body || !req.body.id) {
            return res.status(500).send('id required');
        }
        var dynamoDb = new DynamoDB({region: process.env.AWS_REGION});
        let params = {
            Key: {
                id: {
                    S: req.body.id
                }
            },
            TableName: process.env.DYNAMO_TABLE,
        }
        return res.send(await dynamodb.deleteItem(params).promise());
    }
}