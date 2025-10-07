import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'ZTOCFBhFJZIQDvzonZHxwTOc07GDbsjc',
    socket: {
        host: 'redis-18031.c273.us-east-1-2.ec2.redns.redis-cloud.com',
        port: 18031
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

export default client;