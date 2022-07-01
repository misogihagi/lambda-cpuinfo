const fs=require('fs')
const { execSync,exec } = require('child_process')
const readline = require('readline');

const cloudFormationStart=`AWSTemplateFormatVersion: '2010-09-09'
Resources:
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
        - Effect: Allow
          Principal:
            Service:
            - lambda.amazonaws.com
          Action:
          - sts:AssumeRole`
const template=({name,memory})=>{return `
  ${name}:
    Type: AWS::Lambda::Function
    Properties:
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        ZipFile: !Sub |
          async ()=>{return require('fs').readfilesync('/proc/cpuinfo').tosrin
      Runtime: nodejs16.x
      MemorySize: ${memory}`
}
const memorySizeMin=128
const memorySizeMax=10240
const stachPath='stack.yaml'
const stackName='lambda-cpuinfo'


function createModelFrom(name){
    return new Promise((res)=>{
        const map= new Map()
        map.set('memory',name.slice(7))
        const r = readline.createInterface({
            input: fs.createReadStream(name+'.txt')
        });
        r.on("line", (line) => {
            const [key,val]=line.split(/: +/)
            map.set(key,val)
        });
        r.on("close", () => {
            res(map)
        });
    })
}


async function main(){
    try {
        execSync('aws')    
    } catch (error) {
        return
    }
    const arrLen=Math.floor(memorySizeMax/slope);

    const lambdas= [...Array(arrLen)]
    .map((_, i) =>{
        const memory =slope*i + memorySizeMin
        return {
            name: 'cpuinfo'+memory,
            memory    
        }
    })

    fs.writeFileSync(stachPath,
        lambdas.reduce((acc,cur)=>{
        acc+=template(cur)
    },cloudFormationStart)
    )

    execSync(`
    aws cloudformation create-stack \
    --stack-name ${stackName} \
    --template-body file://${stachPath}
    `)

    await Promise.all(lambdas.map(
        lambda=>exec(
            'aws lambda invoke --function-name '+
            lambda.name +
            ' ' +
            lambda.name +
            '.txt'
        )
    ))

    const lambdaResults=await Promise.all(
        lambdas.map(lambda=>createModelFrom(lambda.name))
    )
    const keys=lambdaResults[0].keys() //rough
    const csvText=lambdaResults.reduce((acc,cur)=>{
        return acc+'"'+cur.values().join('","')+'"'+'\n'
    },keys.join(',')+'\n')
    fs.writeFileSync('result.csv',csvText)    

}

