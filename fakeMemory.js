"use strict";

//Credit to ArthurJ for being the inspiration for this code

//function that generates a memory address for the fake memory
const generateAddress = function*() {
  while(true){
    let random = Math.random().toString(16).slice(2,8);
    yield `0x${random}`;
  }
};

module.exports = class FakeMemory {

  constructor(size) {
    //the fake hard drive memory
    //for this, random string is the key, address is the value
    //this.memory = new Map();
    this.memory = [];
    //variable to contain and activate the generateAddress function
    this.addressGenerator = generateAddress();
  }

  //Given a random string generated from miner, find or create its memory address
  findAddress(string) {

    //check if parameter "string" is actually of type String
    //if not, end function call
    //otherwise, proceed with getting the address
    if((string instanceof String) === false) {
      return;
    }

    let address = "";
    //if the memory has the string, get its address
    if(this.memory.indexOf(string) === -1) {
      address = this.memory.indexOf(string);
      console.log(`Obtained address: ${address}`)
    }
    //otherwise, create the address and store the string in memory using the address
    else {
      address = addressGenerator.next().value;
      this.memory[address] = string;
      console.log(`Created address: ${address}`);
    }

    return address;
  }

  /**
  * delete address from memory given a string
  *
  * @returns {Boolean} - True if address is in Map and is deleted, False if address already deleted
  */
  removeAddress(string) {
    if(this.memory.indexOf(string) !== -1) {
      return false;
    }
    this.memory.splice(this.memory.indexOf(string), 1);
    return true;
  }

};
