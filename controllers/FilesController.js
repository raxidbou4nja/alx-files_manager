import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { promisify } from 'util';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { ObjectID } from 'mongodb';
import path from 'path';
import Queue from 'bull';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

const fileQueue = new Queue('fileQueue');

async function postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');

    const userObjId = new ObjectID(userId);
    const parentObjId = parentId ? new ObjectID(parentId) : 0;


    if (parentId) {
      const parentFile = await filesCollection.findOne({ _id: parentObjId });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const newFile = {
      userId: userObjId,
      name,
      type,
      isPublic,
      parentId: parentId ? parentObjId : 0,
    };

    if (type === 'folder') {
      const result = await filesCollection.insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!(await existsAsync(folderPath))) {
        await mkdirAsync(folderPath, { recursive: true });
      }

      const localPath = `${folderPath}/${uuidv4()}`;
      await writeFileAsync(localPath, Buffer.from(data, 'base64'));

      newFile.localPath = localPath;

      const result = await filesCollection.insertOne(newFile);
      
      // Add job to queue if the file is an image
      if (type === 'image') {
        fileQueue.add({ userId, fileId: result.insertedId });
      }

      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
}



async function getShow(req, res) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenKey = `auth_${token}`;
  const userId = await redisClient.get(tokenKey);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);
  const fileObjId = req.params.id ? new ObjectID(req.params.id) : 0;

  try {
    const file = await filesCollection.findOne({ _id: fileObjId, userId: userObjId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


async function getIndex(req, res) {
  try {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page, 10) || 0;
    const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
    const userObjId = userId ? new ObjectID(userId) : 0;
    const parentObjId = req.query.parentId ? new ObjectID(req.query.parentId) : 0;

    const pipeline = [
      { $match: { userId: userObjId, parentId: parentObjId } },
      { $sort: { name: 1 } },
      { $skip: page * 20 },
      { $limit: 20 }
    ];

    const files = await filesCollection.aggregate(pipeline).toArray();
    return res.json(files.map(({ id, userId, name, type, isPublic, parentId }) => ({
      id,
      userId,
      name,
      type,
      isPublic,
      parentId,
    })));
  } catch (error) {
    console.error('Error fetching files:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function putPublish(req, res) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenKey = `auth_${token}`;
  const userId = await redisClient.get(tokenKey);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);
  const fileObjId = req.params.id ? new ObjectID(req.params.id) : 0;

  try {
    const file = await filesCollection.findOneAndUpdate(
      { _id: fileObjId, userId: userObjId },
      { $set: { isPublic: true } },
      { returnOriginal: false }
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file.value);
  } catch (error) {
    console.error('Error publishing file:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


async function putUnpublish(req, res) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenKey = `auth_${token}`;
  const userId = await redisClient.get(tokenKey);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);
  const fileObjId = req.params.id ? new ObjectID(req.params.id) : 0;

  try {
    const file = await filesCollection.findOneAndUpdate(
      { _id: fileObjId, userId: userObjId },
      { $set: { isPublic: false } },
      { returnOriginal: false }
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file.value);
  } catch (error) {
    console.error('Error unpublishing file:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getFile(req, res) {
    const token = req.headers['x-token'];

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);
    
    const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
    const userObjId = new ObjectID(userId);
    const fileObjId = req.params.id ? new ObjectID(req.params.id) : 0;

    try {
      const file = await filesCollection.findOne({ _id: fileObjId, userId: userObjId });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (!file.isPublic && file.userId.toString() !== userId) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: 'A folder doesn\'t have content' });
      }

      if (!file.localPath) {
        return res.status(404).json({ error: 'Not found' });
      }

      let filePath = file.localPath;
      const size = req.query.size;

      if (size) {
        if (![100, 250, 500].includes(parseInt(size, 10))) {
          return res.status(400).json({ error: 'Invalid size' });
        }
        filePath = `${file.localPath}_${size}`;
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const fileContent = fs.readFileSync(filePath);
      const mimeType = mime.contentType(path.extname(file.name));

      res.setHeader('Content-Type', mimeType);
      res.send(fileContent);
    } catch (error) {
      console.error('Error fetching file data:', error);
      return res.status(500).json({ error: 'Internal server error' });
  }
}

const FilesController = {
  postUpload,
  getShow,
  getIndex,
  putPublish,
  putUnpublish,
  getFile,
};

export default FilesController;