import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  const filesCollection = dbClient.client.db(dbClient.dbName).collection('files');
  const userObjId = new ObjectID(userId);
  const fileObjId = new ObjectID(fileId);

  const file = await filesCollection.findOne({ _id: fileObjId, userId: userObjId });

  if (!file) {
    return done(new Error('File not found'));
  }

  const { localPath } = file;
  if (!localPath) {
    return done(new Error('Local path not found'));
  }

  try {
    const options = [
      { width: 500 },
      { width: 250 },
      { width: 100 },
    ];

    for await (const option of options) {
      const thumbnail = await imageThumbnail(localPath, option);
      const thumbnailPath = `${localPath}_${option.width}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
    }

    done();
  } catch (error) {
    done(error);
  }
  return null; // Add a return statement at the end of the async arrow function
});

fileQueue.on('failed', (job, err) => {
  console.error(`Job failed ${job.id}: ${err.message}`);
});

fileQueue.on('completed', (job) => {
  console.log(`Job completed ${job.id}`);
});
