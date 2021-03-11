const { Router } = require('express');
const { v4: uuid } = require('uuid');

const routes = Router();

const accounts = [];

const verifyAccountMiddleware = ({
  from,
  condition = false,
  error = 'Account not found',
  statusCode = 400
}) => {
  return (request, response, next) => {
    const { cpf } = request[from];
  
    const account = accounts.find(acc => acc.cpf === cpf);
  
    if(!!account === condition) {
      return response.status(statusCode).json({ error });
    }

    request.account = account;

    return next();
  }
}

const getBalance = (statement) => {
  const balance = statement.reduce((acc, operation) => {
    if(operation.type === 'credit') {
      return acc + operation.amount; 
    } 

    return acc - operation.amount;
  }, 0);

  return balance;
}

routes.post('/accounts', verifyAccountMiddleware({
  from: 'body',
  condition: true,
  error: 'Account already exists'
}),(request, response) => {
  const {
    cpf,
    name 
  } = request.body;

  const account = {
    id: uuid(),
    cpf,
    name,
    statement: []
  };

  accounts.push(account)

  return response.status(201).json(account);
});

routes.get('/accounts', verifyAccountMiddleware({ from: 'headers'}), (request, response) => {
  const { account } = request;

  return response.json(account);
})

routes.put('/accounts', verifyAccountMiddleware({ from: 'headers'}), (request, response) => {
  const { account } = request;
  const { name } = request.body;

  account.name = name;

  return response.json(account);
})

routes.delete('/accounts', verifyAccountMiddleware({ from: 'headers'}), (request, response) => {
  const { account } = request;

  accounts.splice(account, 1);

  return response.status(204).send();
})

routes.get('/statement', verifyAccountMiddleware({
  from: 'headers'
}),(request, response) => {
  const { date } = request.query;
  const { account } = request;

  const { statement } = account;

  if(!date) {
    return response.json(statement);
  }

  const baseDate = new Date(`${date} 00:00`);
  const filteredStatement = statement.filter(item => item.created_at.getTime() <= baseDate.getTime());

  return response.json(filteredStatement);
})

routes.post('/deposit', verifyAccountMiddleware({ from: 'headers' }), (request, response) => {
  const { account } = request;
  
  const {
    description,
    amount
  } = request.body;

  const statementOperation = {
    description,
    amount,
    created_at: new Date(),
    type: 'credit'
  };

  account.statement.push(statementOperation);

  return response.status(201).json(statementOperation);
})

routes.post('/withdraw', verifyAccountMiddleware({ from: 'headers' }), (request, response) => {
  const { account } = request;
  
  const {
    amount
  } = request.body;

  const balance = getBalance(account.statement);

  if(amount > balance) {
    return response.status(400).json({ error: 'Insufficient funds!'});
  }

  const statementOperation = {
    amount,
    created_at: new Date(),
    type: 'debit'
  };

  account.statement.push(statementOperation);

  return response.status(201).json(statementOperation);
})

routes.get('/balance', verifyAccountMiddleware({ from: 'headers'}), (request, response) => {
  const { account } = request;

  const balance = getBalance(account.statement);

  return response.json({ balance })
})

module.exports = routes;