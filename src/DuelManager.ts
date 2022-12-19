export class DuelManager{

    constructor() {

    }
    public battle(user1: string, user2: string, amount: number): rpcResult {
        const possibleScenario = this.randomIntFromInterval(0,9);
        //Draw
        if (possibleScenario == 0 || possibleScenario == 1) {
            const choices = ["🧻", "✂️", "🪨 "]
            const chosen = choices[this.randomIntFromInterval(0, choices.length-1)]
            return (new rpcResult(0, `The duel has concluded in a draw. Both players chose ${chosen}.`))
            //First wins
        } else if (possibleScenario > 1 && possibleScenario <= 5 ) {
            const choices = [["🧻", "✂️"], ["✂️", "🪨 "], ["🪨 ", "🧻"]]
            const chosen = choices[this.randomIntFromInterval(0, choices.length-1)]
            return (new rpcResult(1,`<@${user1}> has won! <@${user1}> chose ${chosen[1]} and <@${user2}> chose ${chosen[0]}.`))
            //Second wins
        } else  {
            const choices = [["🧻", "✂️"], ["✂️", "🪨 "], ["🪨 ", "🧻"]]
            const chosen = choices[this.randomIntFromInterval(0, choices.length-1)]
            return (new rpcResult(2,`<@${user2}> has won! <@${user2}> chose ${chosen[1]} and <@${user1}> chose ${chosen[0]}.`))
        }
    }
    private randomIntFromInterval(min: number, max: number) { // min and max included 
        return Math.floor(Math.random() * (max - min + 1) + min)
      }

}

export class rpcResult {
    constructor(public outcomeCode: number, public outcomeText: string) {}
}