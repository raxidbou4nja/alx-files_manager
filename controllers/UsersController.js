import sha1 from 'sha1';
import dbClient from '../utils/db';

const UsersController = {
    async postNew(req, res) {
        const { email, password } = req.body || {};

        if (!req.body || !email) {
            return res.status(400).json({ error: 'Missing email' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }

        const usersCollection = dbClient.client.db(dbClient.dbName).collection('users');

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Already exist' });
        }

        const hashedPassword = sha1(password);

        const result = await usersCollection.insertOne({ email, password: hashedPassword });
        const newUser = { id: result.insertedId, email };

        return res.status(201).json(newUser);
    },

    async getMe(req, res) {
        const token = req.headers['x-token'];
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
    
        const tokenKey = `auth_${token}`;
        const userId = await redisClient.getAsync(tokenKey);
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
    
        const user = await dbClient.db.collection('users').findOne({ _id: new dbClient.ObjectId(userId) });
        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
    
        res.status(200).json({ id: user._id, email: user.email });
    },
};

export default UsersController;
