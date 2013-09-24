/*!
 * ots - test/client.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var ots = require('../');
var should = require('should');
var config = require('./config.js');
var EventProxy = require('eventproxy').EventProxy;
var crypto = require('crypto');
var mm = require('mm');

function md5(s) {
  var hash = crypto.createHash('md5');
  hash.update(s);
  return hash.digest('hex');
}

describe('client.test.js', function() {
  var client = ots.createClient({
    accessID: config.accessID,
    accessKey: config.accessKey,
    APIHost: config.APIHost
  });

  afterEach(mm.restore);

  before(function (done) {
    var ep = EventProxy.create('testgroup', 'test', 'testuser', 'testurl', function () {
      done();
    });
    client.deleteTableGroup('testgroup', function (err) {
      ep.emit('testgroup');
    });
    client.deleteTable('test', function (err) {
      ep.emit('test');
    });
    client.createTable({
      TableName: 'testuser',
      PrimaryKey: [
        { 'Name': 'uid', 'Type': 'STRING' },
        { 'Name': 'firstname', 'Type': 'STRING' },
      ],
      PagingKeyLen: 1,
    }, function (err, result) {
      ep.emit('testuser')
    });
    client.createTable({
      TableName: 'testurl',
      PrimaryKey: [
        { 'Name': 'md5', 'Type': 'STRING' },
      ],
      PagingKeyLen: 0,
    }, function (err, result) {
      ep.emit('testurl')
    });
  });

  describe('createTableGroup()', function () {
    it('should create a group success', function (done) {
      client.createTableGroup('testgroup', 'STRING', function (err) {
        should.not.exist(err);
        client.createTableGroup('testgroup', 'STRING', function (err) {
          should.exist(err);
          err.name.should.equal('OTSStorageObjectAlreadyExistError');
          err.message.should.equal('Requested table/view does exist.');
          err.code.should.equal('OTSStorageObjectAlreadyExist');
          done();
        });
      });
    });

    it('should create a group with wrong key type', function (done) {
      client.createTableGroup('testgroup', 'BOOLEAN', function (err) {
        should.exist(err);
        err.name.should.equal('OTSParameterInvalidError');
        err.message.should.equal('BOOLEAN is an invalid type for primary key.');
        done();
      });
    });
  });

  describe('listTableGroup()', function () {
    it('should list all groups', function (done) {
      client.listTableGroup(function (err, groups) {
        should.not.exist(err);
        groups.should.be.an.instanceof(Array);
        groups.length.should.above(0);
        // groups.should.include('testgroup');
        done();
      });
    });
  });

  describe('deleteTableGroup()', function () {
    before(function (done) {
      client.createTableGroup('testgroup', 'STRING', function (err) {
        done();
      });
    });

    it('should delete a group', function (done) {
      client.deleteTableGroup('testgroup', function (err) {
        should.not.exist(err);
        client.deleteTableGroup('testgroup', function (err) {
          should.exist(err);
          err.name.should.equal('OTSStorageObjectNotExistError');
          err.message.should.equal('Requested table/view doesn\'t exist.');
          done();
        });
      });
    });
  });

  describe('createTable()', function () {

    it('should return OTSParameterInvalidError when missing primary key', function (done) {
      client.createTable({ TableName: 'test' }, function (err, result) {
        should.exist(err);
        err.name.should.equal('OTSParameterInvalidError');
        err.message.should.equal('The table/view does not specify the primary key.');
        done();
      });
    });

    it('should create "test" table success', function(done) {
      client.createTable({
        TableName: 'test',
        PrimaryKey: [
          {'Name': 'uid', 'Type': 'STRING'},
        ],
        View: [
          { 
            'Name': 'view1', 
            'PrimaryKey' : [
              {'Name':'uid', 'Type':'STRING'},
              {'Name':'flag', 'Type':'STRING'},
              {'Name':'docid', 'Type':'STRING'},
            ],
            'Column' : [
              {'Name':'updatetime', 'Type':'STRING'},
              {'Name':'createtime', 'Type':'STRING'},
            ],
          }
        ]
      }, function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should get "test" table meta success', function (done) {
      client.getTableMeta('test', function (err, meta) {
        should.not.exist(err);
        // console.log('%j', meta)
        meta.should.have.keys([ 'tableName', 'primaryKeys', 'views' ]);
        meta.tableName.should.equal('test');
        meta.primaryKeys[0].should.have.keys([ 'name', 'type' ]);
        // meta.views.PrimaryKey.should.length(3);
        // meta.views.Column.should.length(2);
        // meta.views.Name.should.equal('view1');
        done();
      });
    });

    it('should list table success', function (done) {
      client.listTable(function (err, tablenames) {
        should.not.exist(err);
        tablenames.should.be.an.instanceof(Array);
        tablenames.should.include('test');
        done();
      });
    });

    it('should create "test" table exist error', function (done) {
      client.createTable({ 
        TableName: 'test', 
        PrimaryKey: [ { Name: 'id', Type: 'STRING' } ] 
      }, function (err, result) {
        should.exist(err);
        err.name.should.equal('OTSStorageObjectAlreadyExistError');
        err.message.should.equal('Requested table/view does exist.');
        done();
      });
    });

    it('should delete "test" table success and error', function (done) {
      client.deleteTable('test', function (err) {
        should.not.exist(err);
        client.deleteTable('test', function (err) {
          should.exist(err);
          err.name.should.equal('OTSStorageObjectNotExistError');
          err.message.should.equal('Requested table/view doesn\'t exist.');
          done();
        });
      });
    });

  });

  describe('Transaction', function () {
    var transactionID = null;
    describe('startTransaction()', function () {
      it('should start and get a transaction id', function (done) {
        client.startTransaction('testuser', 'foo', function (err, tid) {
          should.not.exist(err);
          tid.should.be.a('string');
          transactionID = tid;
          done();
        });
      });
    });

    describe('commitTransaction()', function () {
      it('should commit a transaction', function (done) {
        client.commitTransaction(transactionID, function (err) {
          should.not.exist(err);
          done();
        });
      });
      it('should OTSParameterInvalid when commit a error tranID', function (done) {
        client.commitTransaction('errorTransactionID', function (err) {
          should.exist(err);
          err.name.should.equal('OTSParameterInvalidError');
          err.message.should.equal('TransactionID is invalid.');
          done();
        });
      });
    });

    describe('abortTransaction()', function () {
      it('should abort a transaction success', function (done) {
        client.startTransaction('testuser', 'foo-need-to-abort', function (err, tid) {
          client.abortTransaction(tid, function (err) {
            should.not.exist(err);
            done();
          });
        });
      });

      it('should OTSStorageSessionNotExist when abort a committed tran', function (done) {
        client.abortTransaction(transactionID, function (err) {
          should.exist(err);
          err.name.should.equal('OTSStorageSessionNotExistError');
          done();
        });
      });

      it('should OTSParameterInvalid when abort a error tranID', function (done) {
        client.abortTransaction('errorTransactionID', function (err) {
          should.exist(err);
          err.name.should.equal('OTSParameterInvalidError');
          err.message.should.equal('TransactionID is invalid.');
          done();
        });
      });
    });
  });

  var now = new Date();
  describe('putData()', function () {
    it('should insert a row success', function (done) {
      client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'mk2' }, 
          { Name: 'firstname', Value: 'yuan' },
        ],
        [
          { Name: 'lastname', Value: 'feng\' mk2' },
          { Name: 'nickname', Value: '  苏千\n ' },
          { Name: 'age', Value: 28 }, // int64
          { Name: 'json', Value: '{ "foo": "bar" }' },
          { Name: 'price', Value: 110.5 },
          { Name: 'enable', Value: true },
          { Name: 'man', Value: true },
          { Name: 'status', Value: null },
          { Name: 'female', Value: false },
          { Name: 'createtime', Value: now.toJSON() },
        ], 
      function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should UPDATE a row error when pk not exists', function (done) {
      client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'mk2222' }, 
          { Name: 'firstname', Value: 'yuannot-exsits' },
        ],
        [
          { Name: 'lastname', Value: 'feng\' mk2' },
          { Name: 'nickname', Value: '  苏千\n ' },
          { Name: 'age', Value: 28 }, // int64
          { Name: 'json', Value: '{ "foo": "bar" }' },
          { Name: 'price', Value: 110.5 },
          { Name: 'enable', Value: true },
          { Name: 'man', Value: true },
          { Name: 'status', Value: null },
          { Name: 'female', Value: false },
          { Name: 'createtime', Value: now.toJSON() },
        ], 
        'UPDATE',
      function (err) {
        should.exist(err);
        err.name.should.equal('OTSStoragePrimaryKeyNotExistError');
        err.message.should.equal("Row to update doesn't exist.");
        done();
      });
    });

    it('should INSERT a row error when pk exists', function (done) {
      client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'mk2' }, 
          { Name: 'firstname', Value: 'yuan' },
        ],
        [
          { Name: 'lastname', Value: 'feng\' mk2' },
          { Name: 'nickname', Value: '  苏千\n ' },
          { Name: 'age', Value: 28 }, // int64
          { Name: 'json', Value: '{ "foo": "bar" }' },
          { Name: 'price', Value: 110.5 },
          { Name: 'enable', Value: true },
          { Name: 'man', Value: true },
          { Name: 'status', Value: null },
          { Name: 'female', Value: false },
          { Name: 'createtime', Value: now.toJSON() },
        ], 
        'INSERT',
      function (err) {
        should.exist(err);
        err.name.should.equal('OTSStoragePrimaryKeyAlreadyExistError');
        err.message.should.equal("Row to insert does exist.");
        done();
      });
    });
  });

  describe('getRow()', function () {
    before(function (done) {
      client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'mk2' }, 
          { Name: 'firstname', Value: 'yuan' },
        ],
        [
          { Name: 'lastname', Value: 'feng\' mk2' },
          { Name: 'nickname', Value: '  苏千\n ' },
          { Name: 'age', Value: 28 }, // int64
          { Name: 'json', Value: '{ "foo": "bar" }' },
          { Name: 'price', Value: 110.5 },
          { Name: 'enable', Value: true },
          { Name: 'man', Value: true },
          { Name: 'status', Value: null },
          { Name: 'female', Value: false },
          { Name: 'createtime', Value: now.toJSON() },
          { Name: 'haha', Value: '哈哈' },
        ], 
      function (err) {
        should.not.exist(err);
        done();
      });
    });
    
    it('should return error', function (done) {
      client.getRow('testuser', 
      [ 
        { Name: 'uid1', Value: 'mk2' }, 
        { Name: 'firstname', Value: 'yuan' },
      ], 
      function (err, row) {
        should.exist(err);
        err.name.should.include('OTSMetaNotMatchError');
        err.message.should.equal('Primary key meta defined in the request does not match with the table meta.');
        err.should.have.property('serverId');
        should.not.exist(row);
        done();
      });
    });

    it('should return a row all columns', function (done) {
      client.getRow('testuser', 
      [ 
        { Name: 'uid', Value: 'mk2' }, 
        { Name: 'firstname', Value: 'yuan' },
      ], 
      function (err, row) {
        should.not.exist(err);
        row.should.have.keys([ 
          'uid', 'firstname', // should include pk
          'lastname', 'nickname',
          'age', 'price', 'enable',
          'man', 'female', 
          'json', 'status',
          'createtime',
          'haha'
        ]);
        row.uid.should.equal('mk2');
        row.firstname.should.equal('yuan');
        row.lastname.should.equal('feng\' mk2');
        row.nickname.should.equal('  苏千\n ');
        row.age.should.equal('28'); // int64, will be auto convert to string by protobuf module
        row.price.should.equal(110.5);
        row.enable.should.equal(true);
        row.man.should.equal(true);
        row.female.should.equal(false);
        row.status.should.equal('null');
        row.createtime.should.equal(now.toJSON());
        row.json.should.equal('{ "foo": "bar" }');
        row.haha.should.equal('哈哈');
        done();
      });
    });

    it('should return a row some columns', function (done) {
      client.getRow('testuser', 
      [ 
        { Name: 'uid', Value: 'mk2' }, 
        { Name: 'firstname', Value: 'yuan' },
      ], 
      ['uid', 'json'],
      function (err, row) {
        should.not.exist(err);
        row.should.have.keys([ 
          'uid',
          'json',
        ]);
        row.uid.should.equal('mk2');
        row.json.should.equal('{ "foo": "bar" }');
        done();
      });
    });

    it('should return null when pk not exists', function (done) {
      client.getRow('testuser', 
      [ 
        { Name: 'uid', Value: 'not-existskey' }, 
        { Name: 'firstname', Value: 'haha' },
      ], function (err, row) {
        should.not.exist(err);
        should.not.exist(row);
        done();
      });
    });
  });

  describe.skip('getRowsByOffset()', function () {
    before(function (done) {
      // insert 20 users first.
      var ep = EventProxy.create();
      ep.after('putDataDone', 20, function () {
        done();
      });
      for (var i = 0; i < 20; i++) {
        client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'testuser_' + (i % 2) }, 
          { Name: 'firstname', Value: 'name' + i } 
        ],
        [
          { Name: 'lastname', Value: 'lastname' + i },
          { Name: 'nickname', Value: '花名' + i },
          { Name: 'age', Value: 20 + i },
          { Name: 'price', Value: 50.5 + i },
          { Name: 'enable', Value: i % 2 === 0 },
          { Name: 'man', Value: i % 2 === 0 },
          { Name: 'female', Value: i % 3 === 0 },
          { Name: 'createtime', Value: new Date().toJSON() },
        ], function (err, result) {
          // should.not.exist(err);
          ep.emit('putDataDone');
        });
      }
    });

    it('should get 5 users, testuser_0 offset:0 top:5', function(done) {
      client.getRowsByOffset('testuser', { Name: 'uid', Value: 'testuser_0' }, null, 0, 5, 
      function (err, rows) {
        should.not.exist(err);
        rows.should.length(5);
        for (var i = rows.length; i--; ) {
          var row = rows[i];
          row.should.have.keys([ 
            'uid', 'firstname', 
            'lastname', 'nickname',
            'age', 'price', 'enable',
            'man', 'female', 'createtime'
          ]);
        }
        done();
      });
    });

    it('should get 5 users, testuser_0 offset:5 top:5', function (done) {
      client.getRowsByOffset('testuser', { Name: 'uid', Value: 'testuser_0' }, 
      [ 'firstname', 'age', 'createtime' ], 5, 5, function (err, rows) {
        should.not.exist(err);
        rows.should.length(5);
        for (var i = rows.length; i--; ) {
          var row = rows[i];
          row.should.have.keys([ 
            'firstname', 
            'age', 'createtime'
          ]);
        }
        done();
      });
    });

    it('should get 0 users, testuser_0 offset:10 top:5', function (done) {
      client.getRowsByOffset('testuser', { Name: 'uid', Value: 'testuser_0' }, 
      [ 'age' ], 10, 5, function (err, rows) {
        should.not.exist(err);
        rows.should.length(0);
        done();
      });
    });

  });

  describe.skip('getRowsByRange()', function () {
    before(function (done) {
      // insert 10 urls first.
      var ep = EventProxy.create();
      ep.after('putDataDone', 10, function () {
        done();
      });
      for (var i = 0; i < 10; i++) {
        var url = 'http://t.cn/abcd' + i;
        client.putData('testurl', 
        [ 
          { Name: 'md5', Value: md5(url) }, 
        ],
        [
          { Name: 'url', Value: url },
          { Name: 'createtime', Value: new Date().toJSON() },
        ], function(err, result) {
          should.not.exist(err);
          ep.emit('putDataDone');
        });
      }
    });
    var nextBegin = null;
    it('should get 6 rows, top:5', function (done) {
      client.getRowsByRange('testurl', null, 
      { Name: 'md5', Begin: ots.STR_MIN, End: ots.STR_MAX }, null, 6, 
      function (err, rows) {
        should.not.exist(err);
        rows.should.length(6);
        for (var i = rows.length; i--; ) {
          var row = rows[i];
          row.should.have.keys([ 
            'md5', 'url', 'createtime'
          ]);
        }
        nextBegin = rows[rows.length - 1].md5;
        done();
      });
    });
    it('should get 5 rows, top:5 next', function(done) {
      client.getRowsByRange('testurl', null, 
      { Name: 'md5', Begin: nextBegin, End: ots.STR_MAX }, null, 6, 
      function(err, rows) {
        should.not.exist(err);
        rows.should.length(6);
        for (var i = rows.length; i--; ) {
          var row = rows[i];
          row.should.have.keys([ 
            'md5', 'url', 'createtime'
          ]);
        }
        nextBegin = rows[rows.length - 1].md5;
        done();
      });
    });
  });

  describe('deleteRow()', function () {
    it('should delete a row', function (done) {
      client.deleteData('testuser', 
        [
          {Name: 'uid', Value: 'mk2'},
          {Name: 'firstname', Value: 'yuan'}
        ],
      function (err) {
        should.not.exist(err);
        // TODO: WTF, delete delay?!
        client.getRow('testuser', [
            {Name: 'uid', Value: 'mk2'},
            {Name: 'firstname', Value: 'yuan'}
          ],
        function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should delete by a not exists key', function (done) {
      client.deleteRow('testuser', [
        {Name: 'uid', Value: 'not-existskey'},
        {Name: 'firstname', Value: 'yuan'}
      ], function (err) {
        should.not.exist(err);
        done();
      });
    });

    it('should delete row with wrong pk', function (done) {
      client.deleteRow('testuser', [
        {Name: 'uid2', Value: 'not-existskey'},
        {Name: 'firstname', Value: 'yuan'}
      ], function (err) {
        should.exist(err);
        err.name.should.equal('OTSMetaNotMatchError');
        err.message.should.equal('Primary key meta defined in the request does not match with the table meta.');
        done();
      });
    });
  });

  describe.skip('batchModifyRow()', function () {
    var url = 'http://t.cn/abc' + new Date().getTime();
    var urlmd5 = md5(url);
    var transactionID = null;

    after(function(done) {
      client.abortTransaction(transactionID, function (err) {
        // console.log(arguments)
        done();
      });
    });

    it('should delete "' + url + '" and insert new', function (done) {
      client.startTransaction('testurl', urlmd5, function (err, tid) {
        should.not.exist(err);
        tid.should.be.a('string');
        transactionID = tid;
        client.batchModifyData('testurl', 
        [
          {
            Type: 'DELETE',
            PrimaryKeys: {Name: 'md5', Value: urlmd5}
          },
          {
            Type: 'PUT',
            PrimaryKeys: {Name: 'md5', Value: urlmd5},
            Columns: [
              {Name: 'url', Value: url},
              {Name: 'createtime', Value: new Date().toJSON()}
            ],
            Checking: 'NO'
          }
        ], tid, function (err, result) {
          should.not.exist(err);
          result.Code.should.equal('OK');
          client.commitTransaction(tid, function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });
  });

  describe('multiGetRow()', function () {
    before(function (done) {
      // insert 20 users first.
      var ep = EventProxy.create();
      ep.after('putDataDone', 5, function () {
        done();
      });
      for (var i = 0; i < 5; i++) {
        client.putData('testuser', 
        [ 
          { Name: 'uid', Value: 'testuser_mget2_' + i }, 
          { Name: 'firstname', Value: 'name' + i } 
        ],
        [
          { Name: 'lastname', Value: 'lastname' + i },
          { Name: 'nickname', Value: '花名' + i },
          { Name: 'age', Value: 20 + i },
          { Name: 'price', Value: 50.5 + i },
          { Name: 'enable', Value: i % 2 === 0 },
          { Name: 'man', Value: i % 2 === 0 },
          { Name: 'female', Value: i % 3 === 0 },
          { Name: 'index', Value: i },
          { Name: 'createtime', Value: new Date().toJSON() },
        ], function (err, result) {
          // should.not.exist(err);
          ep.emit('putDataDone');
        });
      }
    });

    it('should return 5 rows and 5 empty rows with all columns', function (done) {
      var pks = [];
      for (var i = 0; i < 10; i++) {
        pks.push([ 
          { Name: 'uid', Value: 'testuser_mget2_' + i }, 
          { Name: 'firstname', Value: 'name' + i } 
        ]);
      }
      client.multiGetRow('testuser', pks, function (err, items) {
        should.not.exist(err);
        items.should.length(10);
        for (var i = 0; i < 5; i++) {
          var item = items[i];
          item.isSucceed.should.equal(true);
          item.error.should.eql({ code: 'OK' });
          item.tableName.should.equal('testuser');
          item.row.should.have.keys('uid', 'age', 'createtime', 'enable', 'female', 'index', 'lastname',
            'man', 'nickname', 'price', 'firstname');
          item.row.index.should.equal(String(i));
        }
        for (var i = 5; i < 10; i++) {
          var item = items[i];
          item.isSucceed.should.equal(true);
          item.error.should.eql({ code: 'OK' });
          item.tableName.should.equal('testuser');
          should.not.exist(item.row);
        }
        done();
      });
    });

    it('should Rows count exceeds the upper limit error', function (done) {
      var pks = [];
      for (var i = 0; i < 11; i++) {
        pks.push([ 
          { Name: 'uid', Value: 'testuser_' + i }, 
          { Name: 'firstname', Value: 'name' + i } 
        ]);
      }
      client.multiGetRow('testuser', pks, function (err, items) {
        should.exist(err);
        err.name.should.equal('OTSParameterInvalidError');
        err.message.should.equal('Rows count exceeds the upper limit');
        done();
      });
    });

    it('should pk error', function (done) {
      var pks = [];
      for (var i = 0; i < 2; i++) {
        pks.push([ 
          { Name: 'uid2', Value: 'testuser_' + i }, 
          { Name: 'firstname', Value: 'name' + i } 
        ]);
      }
      client.multiGetRow('testuser', pks, function (err, items) {
        should.exist(err);
        err.name.should.equal('OTSMetaNotMatchError');
        err.message.should.equal('Primary key schema from request is not match with table meta: uid2:STRING,firstname:STRING');
        done();
      });
    });
  });

  describe('mock()', function () {
    var _client = ots.createClient({
      accessID: config.accessID,
      accessKey: config.accessKey,
      APIHost: config.APIHost,
      requestTimeout: 1
    });

    after(function () {
      _client.close();
    });

    it('request error', function (done) {
      _client.getRow('testuser', 
      [ 
        { Name: 'uid', Value: 'mk2' }, 
        { Name: 'firstname', Value: 'yuan' },
      ], 
      function (err, row) {
        should.exist(err);
        err.name.should.include('OTSConnectionTimeoutError');
        done();
      });
    });

    it('should return error when dns error', function (done) {
      mm.error(require('dns'), 'resolve4');
      _client.dns.domains = {
        lookup: {},
        resolve4: {}
      };
      _client.getRow('testuser', 
      [ 
        { Name: 'uid', Value: 'mk2' }, 
        { Name: 'firstname', Value: 'yuan' },
      ], 
      function (err, row) {
        should.exist(err);
        err.name.should.include('MockError');
        done();
      });
    });
  });

});
