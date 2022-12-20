import { readFileSync, writeFileSync } from "fs";

export class Poll {
    optionNames: string[] = []
    question: string
    bets: Bet[] = []
    pollId: number
    static latestId = 1;
    pollStatus: string = "OPEN";
    winningOption: number = -1;
    constructor(optionNames: string[], question: string) {
        this.optionNames = optionNames
        this.question = question
        this.pollId = Poll.latestId
        Poll.latestId ++
    }

    public static rebuildPollFromData(optionNames: string[], question: string, bets: Bet[], pollId: number, pollStatus: string, winningOption: number) {
        const toRet = new Poll(optionNames, question)
        Poll.latestId --;
        toRet.bets = bets;
        toRet.pollId = pollId;
        toRet.pollStatus = pollStatus
        toRet.winningOption = winningOption
        return toRet
    }

    public makeABet(bet: Bet) {
        this.bets.push(bet)
    }

    public getTotalPollAmount(): number {
        return Math.max(0.0000001, this.bets.map(x => x.amount).reduce((x, y) => x+y, 0))
    }

    public getVotesPerOption(): [number, number][] {
        let counter = 1
        const votesPerOption = this.optionNames.map(x => {
            counter ++
            return counter -1
        }).map(x => {
            const amountForThisBet = this.bets.filter(bet => bet.option == x).map(x => x.amount).reduce((x, y) => x+y, 0)
            const toRet: [number, number] = [x, amountForThisBet]
            return toRet
        })

        return votesPerOption
    }

    public resolveBet(winningOption: number): [string, number][] {
        const totalAmount = this.getTotalPollAmount()
        const winningBets = this.bets.filter(x => x.option == winningOption)
        const allUsersIn = [...new Set(this.bets.map(x => x.user))]
        const userWinningBetPairs = allUsersIn.map(x => {
            let hasBet = 0
            winningBets.forEach(bet => {
                if (bet.user == x) {
                    hasBet += bet.amount
                }
            })
            const toRet: [string, number] = [x, hasBet]
            return toRet
        })
        const totalAmountOfWinningOption = this.bets.filter(x => x.option == winningOption).map(x => x.amount).reduce((x, y) => x + y, 0)
        
        let userGetsAmount = userWinningBetPairs.map(x => {
            const toRet: [string, number] = [x[0], x[1]/totalAmountOfWinningOption * totalAmount]
            if (isNaN(toRet[1])) {
                toRet[1] = 0
            }
            return toRet
        })
        if (totalAmountOfWinningOption == 0) {
            userGetsAmount = this.getUserHasBetTotal()
        }
        return userGetsAmount
    }

    public getUserHasBetTotal(): [string, number][] {
        const allUsersIn = [...new Set(this.bets.map(x => x.user))]
        const userTotalBetPairs = allUsersIn.map(x => {
            let hasBet = 0
            this.bets.forEach(bet => {
                if (bet.user == x) {
                    hasBet += bet.amount
                }
            })
            const toRet: [string, number] = [x, hasBet]
            return toRet
        })
        return userTotalBetPairs
    } 

    public markAsClosed(winningOption: number) {
        this.winningOption = winningOption;
        this.pollStatus = "CLOSED";
    }

    public markAsLocked() {
        this.pollStatus = "LOCKED";
    }

    public giveBackWhenUndone(): [string, number][] {
        if (this.pollStatus != "CLOSED") {
            return this.getUserHasBetTotal()
        } else {
            const haveSpent = this.getUserHasBetTotal()
            const wasGivenBack = this.resolveBet(this.winningOption).map(x => {
                const toRet: [string, number] =  [x[0], -x[1]]
                return toRet
            });
            return haveSpent.concat(wasGivenBack)
        }
    }
public static writePollsToFile(filePath: string, polls:Poll[]) {
    writeFileSync(filePath, JSON.stringify(polls))
}

public static readPollsFromFile(filePath: string): Poll[] {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Poll[]
    const parsed_data = data.map(x => {
        let record = Poll.rebuildPollFromData(x.optionNames, x.question, x.bets, x.pollId, x.pollStatus, x.winningOption)
        record.bets = record.bets.map(x => new Bet(x.option, x.amount, x.user))
        return record
    })
     return parsed_data
}

}

export class Bet {
    constructor(public option: number, public amount: number, public user: string) {}
}