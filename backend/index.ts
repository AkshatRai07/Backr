import { BankClient } from './bankClient';
import { supabase } from './db';
import 'dotenv/config';

const VAULT_ADDRESS = process.env.VAULT_ADDRESS!; // Where garnished wages go

async function main() {
    console.log("Starting Backr Daemon...");
    
    // 1. Initialize the wrapper
    const bank = new BankClient();
    await bank.init(); // Connects to Websocket & Authenticates

    console.log("Waiting for incoming transactions...");

    // 2. Define the Wage Garnishing Logic
    bank.onTransfer(async (transfer) => {
        console.log(`\nIncoming Transfer Detected! Amount: ${transfer.amount}`);

        // We assume 'this' wallet is the User's wallet being managed by the daemon.
        // In a real app, this daemon might manage multiple keys, but here we check 'self'.
        const userWallet = (process.env.PRIVATE_KEY as string); 
        // Note: In production, extract address from private key properly here for DB lookup
        
        // A. Check Database for Debt
        // For hackathon, we query based on the wallet running this script
        // Or if this script acts as a relay, we check the 'to' address in payload.
        
        // Let's assume we are acting ON BEHALF of the borrower (Borrower = Self)
        const myAddress = "0x..."; // Replace with logic to get public address from Private Key

        const { data: debts, error } = await supabase
            .from('debts')
            .select('*')
            .eq('borrower_address', myAddress) // Check if I have debt
            .gt('amount_owed', 0);

        if (error || !debts || debts.length === 0) {
            console.log("No active debt found. Accepting full amount.");
            await bank.acceptTransfer(transfer);
            return;
        }

        const activeDebt = debts[0];
        console.log(`Active Debt Found: ${activeDebt.amount_owed} USD. Initiating Garnishment.`);

        // B. Calculate Split
        const incoming = Number(transfer.amount);
        const garnishAmount = Math.floor(incoming * 0.5); // 50%
        const remainder = incoming - garnishAmount;

        // C. Execute Logic
        // 1. Accept the funds into our channel (Hold)
        await bank.acceptTransfer(transfer);

        // 2. Pay the Vault (Repayment)
        if (garnishAmount > 0) {
            console.log(`Garnishing ${garnishAmount}... sending to Vault.`);
            await bank.sendTransfer(VAULT_ADDRESS, garnishAmount);
            
            // Update DB
            const newDebt = Math.max(0, Number(activeDebt.amount_owed) - garnishAmount);
            await supabase
                .from('debts')
                .update({ amount_owed: newDebt })
                .eq('id', activeDebt.id);
            console.log(`Debt reduced to ${newDebt}`);
        }

        // 3. Keep the remainder (Pocket Money)
        // Since the funds are already in our wallet (via acceptTransfer), 
        // we don't need to "send" the remainder to ourselves. It's already there.
        console.log(`Remaining ${remainder} kept as pocket money.`);
    });
}

main().catch(console.error);
