
export class MoneyRecord {

    userId: string
    currentBalance: number
    lastTimeFreeRewardTaken: number = 0

    constructor(userId: string, currentBalance: number) {
      this.userId = userId;
      this.currentBalance = currentBalance;
    }

    asString() {
        return this.userId + " " + this.currentBalance.toString()
    }

    static fromString(stringToRead: string) {
        
        const partsOfString = stringToRead.split(/\s+/);
        if (partsOfString.length < 2  || partsOfString[0] == "" || isNaN(parseFloat(partsOfString[1]))) { 
            return null
        }
        const uniqueUsername = partsOfString[0]
        const currentBalance = parseFloat(partsOfString[1])
        return new MoneyRecord(uniqueUsername, currentBalance)
    }

}

