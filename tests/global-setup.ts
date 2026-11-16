export default async function globalSetup(){const res=await fetch('http://localhost:3000/bms/health');if(!res.ok)throw new Error('Start the shared stack and BMS stack before the ecosystem tests.');}
