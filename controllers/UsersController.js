// controllers/UsersController.js

import dbClient from '../utils/db';
import { ObjectId } from 'mongodb';
import sha1 from 'sha1';

const UsersController = {
    async postNew(req, res) {
        const { email, password } = req.body;

        if (!email) {
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
};

export default UsersController;
