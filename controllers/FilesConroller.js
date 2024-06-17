import fs from 'fs';
import dbClient from '../utils/db';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Readable } from 'stream';
import { ObjectID } from 'mongodb';

const pipelineAsync = promisify(pipeline);

const FilesController = {
    async postUpload(req, res) {
        const { name, type, parentId, isPublic, data } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        if (!type || !['folder', 'file', 'image'].includes(type)) {
            return res.status(400).json({ error: 'Missing type' });
        }

        if (type !== 'folder' && !data) {
            return res.status(400).json({ error: 'Missing data' });
        }

        const userId = req.user.id;

        if (parentId) {
            const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
            const parentFile = await filesCollection.findOne({ _id: ObjectID(parentId) });

            if (!parentFile) {
                return res.status(400).json({ error: 'Parent not found' });
            }

            if (parentFile.type !== 'folder') {
                return res.status(400).json({ error: 'Parent is not a folder' });
            }
        }

        const file = {
            userId,
            name,
            type,
            parentId: parentId || 0,
            isPublic: isPublic || false,
        };

        const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
        const result = await filesCollection.insertOne(file);

        if (type === 'folder') {
            return res.status(201).json({
                id: result.insertedId,
                name,
                type,
                parentId: file.parentId,
            });
        } else {
            const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
            const localPath = `${folderPath}/${result.insertedId}`;

            const writeStream = fs.createWriteStream(localPath);
            writeStream.on('finish', () => {
                return res.status(201).json({
                    id: result.insertedId,
                    name,
                    type,
                    parentId: file.parentId,
                    localPath,
                });
            });

            const readable = Readable.from(data);
            readable.pipe(writeStream);
        }
    },

    async getShow(req, res) {
        // Existing code for the getShow endpoint
    },
};

export default FilesController;