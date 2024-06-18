import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { promisify } from 'util';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { ObjectID } from 'mongodb';


const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

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

    if (parentId !== 0) {
      const parentFile = await filesCollection.findOne({ _id: new dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const userObjId = new ObjectID(userId);
    const parentObjId = new ObjectID(parentId);

    const newFile = {
      userId: userObjId,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : parentObjId,
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

  const fileId = req.params.id;
  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);

  try {
    const file = await filesCollection.findOne({ _id: new ObjectID(fileId), userId: userObjId });

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
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenKey = `auth_${token}`;
  const userId = await redisClient.get(tokenKey);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parentId = req.query.parentId || '0';
  const page = parseInt(req.query.page, 10) || 0;
  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);
  const parentObjId = new ObjectID(parentId);

  try {
    const pipeline = [
      { $match: { userId: userObjId, parentId: parentObjId } },
      { $sort: { name: 1 } }, // Example sorting by name
      { $skip: page * 20 },
      { $limit: 20 }
    ];

    const files = await filesCollection.aggregate(pipeline).toArray();
    return res.json(files);
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

  const fileId = req.params.id;
  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);

  try {
    const file = await filesCollection.findOneAndUpdate(
      { _id: new ObjectID(fileId), userId: userObjId },
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

  const fileId = req.params.id;
  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);

  try {
    const file = await filesCollection.findOneAndUpdate(
      { _id: new ObjectID(fileId), userId: userObjId },
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
  const fileId = req.params.id;

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

  try {
    const file = await filesCollection.findOne({ _id: new ObjectID(fileId), userId: userObjId });

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

    const fileContent = fs.readFileSync(file.localPath);

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