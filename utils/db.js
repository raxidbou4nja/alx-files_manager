import { MongoClient } from 'mongodb';

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';
        
        const url = `mongodb://${host}:${port}`;
        
        this.client = new MongoClient(url, { useUnifiedTopology: true });
        this.dbName = database;

        this.client.connect().catch((err) => {
            console.error(`Failed to connect to MongoDB: ${err}`);
        });
    }

    isAlive() {
        return this.client.isConnected();
    }

    async nbUsers() {
        return this.client.db(this.dbName).collection('users').countDocuments();
    }

    async nbFiles() {
        return this.client.db(this.dbName).collection('files').countDocuments();
    }
}
ent();

export default dbClient;
