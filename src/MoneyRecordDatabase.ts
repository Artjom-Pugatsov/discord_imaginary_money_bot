import { MoneyRecord } from "./Record"
import { CheckUserInServer, CheckUserIsOwner} from "./ServerValidator"
import { PathOrFileDescriptor, readFileSync, writeFileSync } from 'fs';
import { json } from "stream/consumers";

export class freeMoneyRewardData {
    constructor(public isSucessfullyTaken: boolean, public nextRewardIn: number) {}
}
export class MoneyRecordDatabase{

    recordBook: MoneyRecord[]
    checkUserOnServer: CheckUserInServer
    checkUserIsOwner: CheckUserIsOwner

    constructor(recordBood: MoneyRecord[], checkUserOnServer: CheckUserInServer, checkUserIsOwner: CheckUserIsOwner) {
        this.recordBook = recordBood
        this.checkUserOnServer = checkUserOnServer
        this.checkUserIsOwner = checkUserIsOwner
    }

    public takeFreeMoneyReward(userId: string) {
        this.addUserIfNotExistsAndInServer(userId)
        const timeRighNow = Date.now()
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound == undefined) {
            //Should never happen
            return new freeMoneyRewardData(false, 0)
        }
        const envRewardAmount = parseInt(process.env.REWARDAMOUNT || '')
        const RewardAmount = Number.isInteger(envRewardAmount) ? envRewardAmount : 10
        const envAddRewardAmount = parseInt(process.env.INCREASE_REWARD_AMOUNT || '')
        const addRewardAmount = Number.isInteger(envAddRewardAmount) ? envAddRewardAmount : 0
        const envTimeToNextRewardReduced = parseInt(process.env.REDUCE_WAIT_TIME_DURATION || '')
        const timeToNextRewardReduced = Number.isInteger(envTimeToNextRewardReduced) ? envTimeToNextRewardReduced : 0
        const envTimeToNextReward = parseInt(process.env.REWARDPERIOD || '')
        let timeToNextReward = Number.isInteger(envTimeToNextReward) ? envTimeToNextReward : 7200000
        console.log(userFound.reduceRewardWaitTimePurchased)
        console.log(timeToNextRewardReduced)
        timeToNextReward = timeToNextReward - (userFound.reduceRewardWaitTimePurchased * timeToNextRewardReduced)
        if (timeRighNow - userFound.lastTimeFreeRewardTaken >  timeToNextReward) {
            userFound.currentBalance += (RewardAmount + userFound.increaseRewardPurchased * addRewardAmount)
            userFound.lastTimeFreeRewardTaken = timeRighNow
            return new freeMoneyRewardData(true, timeToNextReward)
        } else {
            return new freeMoneyRewardData(false, timeToNextReward -(timeRighNow - userFound.lastTimeFreeRewardTaken))
        }
    }

    public static readDataFile(filepath: string, checkUserOnServer: CheckUserInServer, checkUserIsOwner: CheckUserIsOwner): MoneyRecordDatabase {

        const data = JSON.parse(readFileSync(filepath, 'utf-8')) as MoneyRecord[]
        const parsed_data = data.map(x => {
            if (x.increaseRewardPurchased == undefined) {
                x.increaseRewardPurchased = 0
            }
            if (x.reduceRewardWaitTimePurchased == undefined) {
                x.reduceRewardWaitTimePurchased = 0
            }
            let record = new MoneyRecord(x.userId, x.currentBalance, x.increaseRewardPurchased, x.reduceRewardWaitTimePurchased)
            record.lastTimeFreeRewardTaken = x.lastTimeFreeRewardTaken
            return record
        })

        return new MoneyRecordDatabase(parsed_data, checkUserOnServer, checkUserIsOwner)

    }

    addUserIfNotExistsAndInServer(userId: string){
        if (this.recordBook.find(x => x.userId == userId) === undefined && this.checkUserOnServer(userId)) {
            this.recordBook.push(new MoneyRecord(userId, 0, 0, 0))
        }
    }

    public writeDataFile(filepath: string, ): void {
        writeFileSync(filepath, JSON.stringify(this.recordBook))
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

    public addCoinsBypassOwnerCheck(userId: string, toAddMoney: number): number {
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

    public purchaseWaitTimeDecrease(userId: string): boolean {
        this.addUserIfNotExistsAndInServer(userId)
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound != null && userFound != undefined) {
            if (userFound.reduceRewardWaitTimePurchased < this.parseIntElseZero(process.env.MAX_REDUCE_WAIT_TIME)) {
                userFound.reduceRewardWaitTimePurchased = userFound.reduceRewardWaitTimePurchased+ 1;
                return true;
            }
        }
        return false;
    }

    public purchaseRewardIncrease(userId: string): boolean {
        this.addUserIfNotExistsAndInServer(userId)
        const userFound = this.recordBook.find(x => x.userId == userId)
        if (userFound != null && userFound != undefined) {
            if (userFound.increaseRewardPurchased < this.parseIntElseZero(process.env.MAX_PURCHASE_INCREASE_REWARD)) {
                userFound.increaseRewardPurchased = userFound.increaseRewardPurchased+ 1;
                return true;
            }
        }
        return false;
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
            let toTransfer = Math.min(fromFound.currentBalance, amount)
            toTransfer = Math.max(0, toTransfer)
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

    public doesUserHaveEnoughCoins(userId: string, amount: number): boolean {
        console.log(this.getCoinAmount(userId))
        console.log(amount)
        return (this.getCoinAmount(userId) > amount)
    }

    public getLeaderBordRangeFromHighest(numberOfTopToShow: number): MoneyRecord[] {
        const toShowNumber = Math.min(numberOfTopToShow, this.recordBook.length)
        const copyOfRecordBook = this.recordBook.map(x =>x)
        copyOfRecordBook.sort((a, b) => -( a.currentBalance - b.currentBalance))
        return copyOfRecordBook.slice(0, toShowNumber)
    }


    private parseIntElseZero(toParse: string | undefined): number {
        if (toParse === undefined) {
            return 0
        }
        if (!isNaN(parseInt(toParse))) {
            return parseInt(toParse)
        } else {
            return Math.round(parseFloat(toParse))
        }
    }

}