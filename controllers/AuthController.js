import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import sha1 from 'sha1';

const AuthController = {
  async getConnect(req, res) {
    console.log("hello toke: ", req);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    const hashedPassword = sha1(password);
    const user = await dbClient.client.db(dbClient.dbName).collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const tokenKey = `auth_${token}`;
    await redisClient.setAsync(tokenKey, user._id.toString(), 'EX', 24 * 60 * 60);

    res.status(200).json({ token });
  },

  async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.getAsync(tokenKey);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.delAsync(tokenKey);
    res.status(204).send();
  }
};

export default AuthController;