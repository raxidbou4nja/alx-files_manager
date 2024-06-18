import { getMongoInstance, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { Queue } from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

// Create a queue to process file generation jobs
const fileQueue = new Queue('file generation');

class FilesController {
  static async postUpload(req, res) {
  }

  static async getShow(req, res) {
  }

  static async getIndex(req, res) {
  }

  static async putPublish(req, res) {
  }

  static async putUnpublish(req, res) {
  }

  static async getFile(req, res) {
  }
}

export default FilesController;