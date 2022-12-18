import { MoneyRecord } from '../src/Record';
import {MoneyRecordDatabase} from '../src/MoneyRecordDatabase'
import { CheckUserInServer, CheckUserIsOwner } from 'src/ServerValidator';


let userInServerValidatorMock: CheckUserInServer;

userInServerValidatorMock = function(userId: string): boolean {
    return true
}
let ownerValidatorMock: CheckUserIsOwner;
ownerValidatorMock = function(userId: string): boolean {
  return true
}


//Will change storage to work from JSON
test('Reads file', () => {
    const weGetWhenRead = MoneyRecordDatabase.readDataFile("tests\\testsReadFile.txt", userInServerValidatorMock, ownerValidatorMock);
    expect(weGetWhenRead).toStrictEqual(new MoneyRecordDatabase([new MoneyRecord("Alex", 100),
     new MoneyRecord("Bob", 23), new MoneyRecord("Alice", 55), new MoneyRecord("dgsa#678", 89)], userInServerValidatorMock, ownerValidatorMock) );
  })


  test('Reads file', () => {
    const toWrite = new MoneyRecordDatabase([new MoneyRecord("Buritto", 1),
    new MoneyRecord("Jack", 0.88), new MoneyRecord("Jacob", 3244234), new MoneyRecord("da#678", -1)], userInServerValidatorMock, ownerValidatorMock);
    toWrite.writeDataFile("tests\\ToWriteInto.txt")
  })