export class Pool {
    optionNames: string[] = []
    question: string
    bets: Bet[] = []
    poolId: number
    static latestId = 1;
    poolStatus: string = "OPEN";
    winningOption: number = -1;
    constructor(optionNames: string[], question: string) {
        this.optionNames = optionNames
        this.question = question
        this.poolId = Pool.latestId
        Pool.latestId ++
    }

    public makeABet(bet: Bet) {
        this.bets.push(bet)
    }

    public getTotalPoolAmount(): number {
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
        const totalAmount = this.getTotalPoolAmount()
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
        
        const userGetsAmount = userWinningBetPairs.map(x => {
            const toRet: [string, number] = [x[0], x[1]/totalAmountOfWinningOption * totalAmount]
            if (isNaN(toRet[1])) {
                toRet[1] = 0
            }
            return toRet
        })
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
        this.poolStatus = "CLOSED";
    }

    public giveBackWhenUndone(): [string, number][] {
        if (this.poolStatus == "OPEN") {
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



}

export class Bet {
    constructor(public option: number, public amount: number, public user: string) {}
}