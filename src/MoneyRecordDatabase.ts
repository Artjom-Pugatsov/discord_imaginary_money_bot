import { MoneyRecord } from "./Record"
import { CheckUserInServer, CheckUserIsOwner} from "./ServerValidator"
import { PathOrFileDescriptor, readFileSync, writeFileSync } from 'fs';

export class MoneyRecordDatabase{

    recordBook: MoneyRecord[]
    checkUserOnServer: CheckUserInServer
    checkUserIsOwner: CheckUserIsOwner

    constructor(recordBood: MoneyRecord[], checkUserOnServer: CheckUserInServer, checkUserIsOwner: CheckUserIsOwner) {
        this.recordBook = recordBood
        this.checkUserOnServer = checkUserOnServer
        this.checkUserIsOwner = checkUserIsOwner
    }

    public static readDataFile(filepath: string, checkUserOnServer: CheckUserInServer, checkUserIsOwner: CheckUserIsOwner): MoneyRecordDatabase {
        const fullfile = readFileSync(filepath as PathOrFileDescriptor, 'utf-8');
        const lines = fullfile.split('\n');
        const records: MoneyRecord[] = []
        lines.forEach(x => {
            
            const transformedString = MoneyRecord.fromString(x)
            if (transformedString != null) {
              records.push(transformedString)  
            }
        })
        return new MoneyRecordDatabase(records, checkUserOnServer, checkUserIsOwner)

    }

    addUserIfNotExistsAndInServer(userId: string){
        if (this.recordBook.find(x => x.userId == userId) === undefined && this.checkUserOnServer(userId)) {
            this.recordBook.push(new MoneyRecord(userId, 0))
        }
    }

    public writeDataFile(filepath: string, ): void {
        let towrite = "";
        if (this.recordBook.length != 0) {
           towrite = this.recordBook.map(x => x.asString()).reduce((x, y) => x +"\n" + y) 
        }
        writeFileSync(filepath as PathOrFileDescriptor, towrite)
    }

   /**
    * Only owner can invoke this method
    * @param requastFormId The id of the user invoking the request
    * @param userId 
    * @param toAddMoney 
    * @returns 
    */
    public addCoins(requastFormId: string, userId: string, toAddMoney: number): number {
        if (!this.checkUserIsOwner(requastFormId)) {
            return 0
        }
        this.addUserIfNotExistsAndInServer(userId)
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound != null && userFound != undefined) {
            userFound.currentBalance += toAddMoney
            return userFound.currentBalance
        }
        return 0
    }

    public setCoins(requastFormId: string, userId: string, toAddMoney: number): number {
        if (!this.checkUserIsOwner(requastFormId)) {
            return 0
        }
        this.addUserIfNotExistsAndInServer(userId)
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound != null && userFound != undefined) {
            userFound.currentBalance = toAddMoney
            return userFound.currentBalance
        }
        return 0
    }

    public transferCoins(requastFormId: string, from: string, to: string, amount:number): number {
        if (requastFormId != from) {
            return 0
        }
        if (amount < 0) {
            amount = 0
        }
        this.addUserIfNotExistsAndInServer(from)
        this.addUserIfNotExistsAndInServer(to)
        const fromFound = this.recordBook.find(x => x.userId == from)
        const toFound = this.recordBook.find(x => x.userId == to)
        if ( fromFound == undefined || toFound == undefined) {
            return 0
        } else {
            const toTransfer = Math.min(fromFound.currentBalance, amount)
            toFound.currentBalance += toTransfer
            fromFound.currentBalance -= toTransfer
            return toTransfer
        }
    }

    public getCoinAmount(userId: string): number {
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound != null && userFound != undefined) {
            return userFound.currentBalance
        }
        return 0
    }

    public getLeaderBordRangeFromHighest(numberOfTopToShow: number): MoneyRecord[] {
        const toShowNumber = Math.min(numberOfTopToShow, this.recordBook.length)
        return this.recordBook.sort(x => -x.currentBalance).slice(0, toShowNumber)
    }

}