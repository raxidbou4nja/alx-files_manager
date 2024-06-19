import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import dbClient from '../utils/db';

describe('+ DBClient utility', () => {
  before(function (done) {
    this.timeout(10000);
    Promise.all([dbClient.db(dbClient.dbName).collection('users'), dbClient.dbClient.db(dbClient.dbName).collection('files')])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})])
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
  });

  it('client is alive', () => {
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('nbUsers returns the correct value', async () => {
    expect(await dbClient.nbUsers()).to.equal(0);
  });

  it('nbFiles returns the correct value', async () => {
    expect(await dbClient.nbFiles()).to.equal(0);
  });
});
