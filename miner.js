"use strict";

let Blockchain = require('./blockchain.js');
let Client = require('./client.js');
let FakeMemory = require('./fakeMemory.js');

let utils = require('./utils.js');

/**
 * Miners are clients, but they also mine blocks looking for "proofs".
 */
module.exports = class Miner extends Client {

  /**
   * When a new miner is created, but the PoW search is **not** yet started.
   * The initialize method kicks things off.
   *
   * @constructor
   * @param {Object} obj - The properties of the client.
   * @param {String} [obj.name] - The miner's name, used for debugging messages.
   * * @param {Object} net - The network that the miner will use
   *      to send messages to all other clients.
   * @param {Block} [startingBlock] - The most recently ALREADY ACCEPTED block.
   * @param {Object} [obj.keyPair] - The public private keypair for the client.
   * @param {Number} [miningRounds] - The number of rounds a miner mines before checking
   *      for messages.  (In single-threaded mode with FakeNet, this parameter can
   *      simulate miners with more or less mining power.)
   */
  constructor({name, net, startingBlock, keyPair, miningRounds=Blockchain.NUM_ROUNDS_MINING} = {}) {
    super({name, net, startingBlock, keyPair});
    //this.miningRounds=miningRounds;
    this.memory = new FakeMemory();

    let memoryUndefinedCheck = this.memory === undefined ? true : false;

    console.log(`this.memory is undefined: ${memoryUndefinedCheck}`);
    //console.log(`Data sector size: ${Blockchain.DATA_SECTOR_SIZE}`);

  }

  /**
   * Starts listeners and begins mining.
   */
  initialize() {
    this.startNewSearch();

    //this.on(Blockchain.START_MINING, this.findProof);
    this.on(Blockchain.START_MINING, this.seal);
    this.on(Blockchain.POST_TRANSACTION, this.addTransaction);

    setTimeout(() => this.emit(Blockchain.START_MINING), 0);
  }

  /**
   * Sets up the miner to start searching for a new block.
   *
   * @param {Set} [txSet] - Transactions the miner has that have not been accepted yet.
   */
  startNewSearch(txSet=new Set()) {
    this.currentBlock = Blockchain.makeBlock(this.address, this.lastBlock);

    txSet.forEach((tx) => this.addTransaction(tx));

    //OLD: Start looking for a proof at 0.
    //this.currentBlock.proof = 0;

    if(this.currentBlock.proof !== undefined){
      this.memory.removeAddress(this.currentBlock.proof.string);
      console.log(`Address from miner memory removed...`);
    }

    //NEW: empty string and memAddress after use
    this.currentBlock.proof = {
      string: "",
      signedString: "",
      sectorSize: Math.floor((Math.random() * 25) + 10),
      pubKey: this.keyPair.public,
      memAddress: ""
    };
  }


  /**
   * Looks for a "proof".  It breaks after some time to listen for messages.  (We need
   * to do this since JS does not support concurrency).
   *
   * The 'oneAndDone' field is used for testing only; it prevents the findProof method
   * from looking for the proof again after the first attempt.
   *
   * @param {boolean} oneAndDone - Give up after the first PoW search (testing only).
  findProof(oneAndDone=false) {
    let pausePoint = this.currentBlock.proof + this.miningRounds;
    while (this.currentBlock.proof < pausePoint) {
      if (this.currentBlock.hasValidProof()) {
        this.log(`found proof for block ${this.currentBlock.chainLength}: ${this.currentBlock.proof}`);
        this.announceProof();
        this.receiveBlock(this.currentBlock);
        this.startNewSearch();
        break;
      }
      this.currentBlock.proof++;
    }
    // If we are testing, don't continue the search.
    if (!oneAndDone) {
      // Check if anyone has found a block, and then return to mining.
      setTimeout(() => this.emit(Blockchain.START_MINING), 0);
    }
  }
  */

  /**
  * Given the size of the data sector, miner must send such to the block to verify it
  *
  * @param {boolean} sentAndDone confirms if the miner has sent the proof. Same intention as that of findProof()'s oneAndDone parameter
  */
  seal() {

    let randomString = "";
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    this.currentBlock.proof.sectorSize = Math.floor((Math.random() * 25) + 10);

    for(let i = 0; i < this.currentBlock.proof.sectorSize; i++){
      randomString+=characters.charAt(Math.floor(Math.random() * characters.length));
    }

    //sign randomized string and give a portion of it and memory address as proof
    this.currentBlock.proof.string = randomString;
    this.currentBlock.proof.signedString = utils.sign(this.keyPair.private, randomString);
    //this.currentBlock.proof.memAddress = this.memory.findAddress(this.currentBlock.proof.string);
    this.currentBlock.proof.memAddress = "0x8564BF3E";
    console.log(`Proof created...`);
    console.log(`Memory address: ${this.memory.findAddress(this.currentBlock.proof.string)}`);
    console.log(`Proof: ${Object.values(this.currentBlock.proof)}`);

    if(this.currentBlock.hasValidProof()){
      console.log(`Proof is valid.`);
      this.announceProof();
      console.log(`Proof announced...`);
      this.receiveBlock(this.currentBlock);
      console.log(`Block received`);
      this.startNewSearch();
      console.log(`Block received and new search commenced...`)
    }
  }

  /**
   * Broadcast the block, with a valid proof included.
   */
  announceProof() {
    //this.net.broadcast(Blockchain.PROOF_FOUND, this.currentBlock);
    this.net.broadcast(Blockchain.PROOF_VERIFIED, this.currentBlock);
  }

  /**
   * Receives a block from another miner. If it is valid,
   * the block will be stored. If it is also a longer chain,
   * the miner will accept it and replace the currentBlock.
   *
   * @param {Block | Object} b - The block
   */
  receiveBlock(s) {
    let b = super.receiveBlock(s);

    if (b === null) return null;

    // We switch over to the new chain only if it is better.
    if (this.currentBlock && b.chainLength >= this.currentBlock.chainLength) {
      this.log(`cutting over to new chain.`);
      let txSet = this.syncTransactions(b);
      this.startNewSearch(txSet);
    }
  }

  /**
   * This function should determine what transactions
   * need to be added or deleted.  It should find a common ancestor (retrieving
   * any transactions from the rolled-back blocks), remove any transactions
   * already included in the newly accepted blocks, and add any remaining
   * transactions to the new block.
   *
   * @param {Block} nb - The newly accepted block.
   *
   * @returns {Set} - The set of transactions that have not yet been accepted by the new block.
   */
  syncTransactions(nb) {
    let cb = this.currentBlock;
    let cbTxs = new Set();
    let nbTxs = new Set();

    // The new block may be ahead of the old block.  We roll back the new chain
    // to the matching height, collecting any transactions.
    while (nb.chainLength > cb.chainLength) {
      nb.transactions.forEach((tx) => nbTxs.add(tx));
      nb = this.blocks.get(nb.prevBlockHash);
    }

    // Step back in sync until we hit the common ancestor.
    while (cb && cb.id !== nb.id) {
      // Store any transactions in the two chains.
      cb.transactions.forEach((tx) => cbTxs.add(tx));
      nb.transactions.forEach((tx) => nbTxs.add(tx));

      cb = this.blocks.get(cb.prevBlockHash);
      nb = this.blocks.get(nb.prevBlockHash);
    }

    // Remove all transactions that the new chain already has.
    nbTxs.forEach((tx) => cbTxs.delete(tx));

    return cbTxs;
  }

  /**
   * Returns false if transaction is not accepted. Otherwise adds
   * the transaction to the current block.
   *
   * @param {Transaction | String} tx - The transaction to add.
   */
  addTransaction(tx) {
    tx = Blockchain.makeTransaction(tx);
    return this.currentBlock.addTransaction(tx, this);
  }

  /**
   * When a miner posts a transaction, it must also add it to its current list of transactions.
   *
   * @param  {...any} args - Arguments needed for Client.postTransaction.
   */
  postTransaction(...args) {
    let tx = super.postTransaction(...args);
    return this.addTransaction(tx);
  }

};
