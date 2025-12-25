#!/usr/bin/env python3
"""
Stellar Account Manager
- Remove trustlines and burn remaining balances
- Claim or reject pending claimable balances
"""

from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from stellar_sdk.exceptions import BadRequestError
import sys

def load_trustlines(secret_key):
    """Load all trustlines for the given account"""
    try:
        keypair = Keypair.from_secret(secret_key)
        public_key = keypair.public_key
        
        server = Server("https://horizon.stellar.org")
        account = server.accounts().account_id(public_key).call()
        
        trustlines = []
        for balance in account['balances']:
            if balance['asset_type'] != 'native':
                trustlines.append({
                    'asset_code': balance['asset_code'],
                    'asset_issuer': balance['asset_issuer'],
                    'balance': balance['balance'],
                    'asset_type': balance['asset_type']
                })
        
        return trustlines, public_key, keypair
    except Exception as e:
        print(f"Error loading trustlines: {e}")
        sys.exit(1)

def load_claimable_balances(public_key):
    """Load all claimable balances for the given account"""
    try:
        server = Server("https://horizon.stellar.org")
        
        # Get claimable balances
        cb_records = server.claimable_balances().for_claimant(public_key).limit(200).call()
        
        claimable_balances = []
        for record in cb_records['_embedded']['records']:
            # Check if this account can claim it
            can_claim = False
            for claimant in record['claimants']:
                if claimant['destination'] == public_key:
                    can_claim = True
                    break
            
            if can_claim:
                asset_info = record['asset'].split(':')
                if len(asset_info) == 1:
                    asset_code = 'XLM'
                    asset_issuer = 'native'
                else:
                    asset_code = asset_info[0]
                    asset_issuer = asset_info[1]
                
                claimable_balances.append({
                    'id': record['id'],
                    'asset_code': asset_code,
                    'asset_issuer': asset_issuer,
                    'amount': record['amount'],
                    'sponsor': record.get('sponsor', 'Unknown')
                })
        
        return claimable_balances
    except Exception as e:
        print(f"Error loading claimable balances: {e}")
        return []

def display_trustlines(trustlines):
    """Display trustlines with selection numbers"""
    if not trustlines:
        print("No trustlines found.")
        return False
    
    print("\n=== Current Trustlines ===")
    for i, tl in enumerate(trustlines, 1):
        print(f"\n{i}. Asset: {tl['asset_code']}")
        print(f"   Balance: {float(tl['balance']):.7f}")
        print(f"   Issuer: {tl['asset_issuer']}")
    
    return True

def display_claimable_balances(claimable_balances):
    """Display claimable balances with selection numbers"""
    if not claimable_balances:
        print("No claimable balances found.")
        return False
    
    print("\n=== Claimable Balances ===")
    for i, cb in enumerate(claimable_balances, 1):
        print(f"\n{i}. Asset: {cb['asset_code']}")
        print(f"   Amount: {float(cb['amount']):.7f}")
        if cb['asset_issuer'] != 'native':
            print(f"   Issuer: {cb['asset_issuer']}")
        print(f"   Sponsor: {cb['sponsor']}")
        print(f"   Balance ID: {cb['id'][:16]}...")
    
    return True

def get_selection(items, item_type="items"):
    """Get user selection of items"""
    print("\n" + "="*50)
    print(f"Enter the numbers of {item_type} (comma-separated)")
    print("Example: 1,3,5 or 'all' for all")
    print("="*50)
    
    selection = input("\nYour selection: ").strip().lower()
    
    if selection == 'all':
        return list(range(len(items)))
    
    try:
        indices = [int(x.strip()) - 1 for x in selection.split(',')]
        # Validate indices
        for idx in indices:
            if idx < 0 or idx >= len(items):
                print(f"Invalid selection: {idx + 1}")
                return None
        return indices
    except ValueError:
        print("Invalid input format.")
        return None

def remove_trustlines(secret_key, keypair, public_key, trustlines, selected_indices):
    """Remove selected trustlines and burn balances"""
    server = Server("https://horizon.stellar.org")
    results = []
    
    print("\n" + "="*50)
    print("REMOVING TRUSTLINES")
    print("="*50)
    
    for idx in selected_indices:
        tl = trustlines[idx]
        asset_name = f"{tl['asset_code']} ({tl['asset_issuer'][:8]}...)"
        
        try:
            # Load fresh account data
            account = server.load_account(public_key)
            
            # Build transaction
            transaction_builder = TransactionBuilder(
                source_account=account,
                network_passphrase=Network.PUBLIC_NETWORK_PASSPHRASE,
                base_fee=100
            )
            
            # If there's a balance, send it to issuer (burn it)
            balance = float(tl['balance'])
            if balance > 0:
                asset = Asset(tl['asset_code'], tl['asset_issuer'])
                transaction_builder.append_payment_op(
                    destination=tl['asset_issuer'],
                    asset=asset,
                    amount=str(balance)
                )
                print(f"\n{asset_name}: Burning {balance:.7f} tokens...")
            
            # Remove trustline
            asset = Asset(tl['asset_code'], tl['asset_issuer'])
            transaction_builder.append_change_trust_op(
                asset=asset,
                limit="0"
            )
            
            # Build, sign and submit
            transaction = transaction_builder.set_timeout(180).build()
            transaction.sign(keypair)
            response = server.submit_transaction(transaction)
            
            results.append({
                'item': asset_name,
                'success': True,
                'hash': response['hash']
            })
            print(f"✓ Successfully removed {asset_name}")
            print(f"  Transaction hash: {response['hash']}")
            
        except BadRequestError as e:
            error_msg = e.extras.get('result_codes', {}).get('operations', ['Unknown error'])[0]
            results.append({
                'item': asset_name,
                'success': False,
                'error': error_msg
            })
            print(f"✗ Failed to remove {asset_name}: {error_msg}")
        except Exception as e:
            results.append({
                'item': asset_name,
                'success': False,
                'error': str(e)
            })
            print(f"✗ Failed to remove {asset_name}: {e}")
    
    return results

def claim_claimable_balances(keypair, public_key, claimable_balances, selected_indices):
    """Claim selected claimable balances"""
    server = Server("https://horizon.stellar.org")
    results = []
    
    print("\n" + "="*50)
    print("CLAIMING BALANCES")
    print("="*50)
    
    for idx in selected_indices:
        cb = claimable_balances[idx]
        balance_name = f"{cb['asset_code']} - {float(cb['amount']):.7f}"
        
        try:
            # Load fresh account data
            account = server.load_account(public_key)
            
            # Build transaction
            transaction_builder = TransactionBuilder(
                source_account=account,
                network_passphrase=Network.PUBLIC_NETWORK_PASSPHRASE,
                base_fee=100
            )
            
            # Claim balance
            transaction_builder.append_claim_claimable_balance_op(
                balance_id=cb['id']
            )
            
            # Build, sign and submit
            transaction = transaction_builder.set_timeout(180).build()
            transaction.sign(keypair)
            response = server.submit_transaction(transaction)
            
            results.append({
                'item': balance_name,
                'success': True,
                'hash': response['hash']
            })
            print(f"✓ Successfully claimed {balance_name}")
            print(f"  Transaction hash: {response['hash']}")
            
        except BadRequestError as e:
            error_msg = e.extras.get('result_codes', {}).get('operations', ['Unknown error'])[0]
            results.append({
                'item': balance_name,
                'success': False,
                'error': error_msg
            })
            print(f"✗ Failed to claim {balance_name}: {error_msg}")
        except Exception as e:
            results.append({
                'item': balance_name,
                'success': False,
                'error': str(e)
            })
            print(f"✗ Failed to claim {balance_name}: {e}")
    
    return results

def reject_claimable_balances(keypair, public_key, claimable_balances, selected_indices):
    """Reject selected claimable balances by claiming and immediately sending back"""
    server = Server("https://horizon.stellar.org")
    results = []
    
    print("\n" + "="*50)
    print("REJECTING BALANCES")
    print("="*50)
    
    for idx in selected_indices:
        cb = claimable_balances[idx]
        balance_name = f"{cb['asset_code']} - {float(cb['amount']):.7f}"
        
        try:
            # Load fresh account data
            account = server.load_account(public_key)
            
            # Build transaction
            transaction_builder = TransactionBuilder(
                source_account=account,
                network_passphrase=Network.PUBLIC_NETWORK_PASSPHRASE,
                base_fee=100
            )
            
            # Claim balance
            transaction_builder.append_claim_claimable_balance_op(
                balance_id=cb['id']
            )
            
            # Send it back to sponsor (reject)
            if cb['asset_code'] == 'XLM':
                asset = None  # Native asset
            else:
                asset = Asset(cb['asset_code'], cb['asset_issuer'])
            
            transaction_builder.append_payment_op(
                destination=cb['sponsor'],
                asset=asset if asset else Asset.native(),
                amount=cb['amount']
            )
            
            # Build, sign and submit
            transaction = transaction_builder.set_timeout(180).build()
            transaction.sign(keypair)
            response = server.submit_transaction(transaction)
            
            results.append({
                'item': balance_name,
                'success': True,
                'hash': response['hash']
            })
            print(f"✓ Successfully rejected {balance_name}")
            print(f"  Transaction hash: {response['hash']}")
            
        except BadRequestError as e:
            error_msg = e.extras.get('result_codes', {}).get('operations', ['Unknown error'])[0]
            results.append({
                'item': balance_name,
                'success': False,
                'error': error_msg
            })
            print(f"✗ Failed to reject {balance_name}: {error_msg}")
        except Exception as e:
            results.append({
                'item': balance_name,
                'success': False,
                'error': str(e)
            })
            print(f"✗ Failed to reject {balance_name}: {e}")
    
    return results

def print_summary(results):
    """Print final summary of operations"""
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f"\nSuccessful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    
    if failed:
        print("\nFailed operations:")
        for r in failed:
            print(f"  - {r['item']}: {r['error']}")

def main_menu():
    """Display main menu and get user choice"""
    print("\n" + "="*50)
    print("STELLAR ACCOUNT MANAGER")
    print("="*50)
    print("\n1. Remove Trustlines (burn balances)")
    print("2. Claim Claimable Balances")
    print("3. Reject Claimable Balances")
    print("4. Exit")
    
    choice = input("\nSelect option (1-4): ").strip()
    return choice

def handle_trustlines(secret_key, keypair, public_key):
    """Handle trustline removal"""
    print("\nLoading trustlines...")
    trustlines, _, _ = load_trustlines(secret_key)
    
    if not display_trustlines(trustlines):
        return
    
    selected_indices = None
    while selected_indices is None:
        selected_indices = get_selection(trustlines, "trustlines to remove")
    
    print("\n" + "="*50)
    print("⚠️  FINAL CONFIRMATION")
    print("="*50)
    print(f"\nYou are about to remove {len(selected_indices)} trustline(s).")
    print("Any remaining balances will be BURNED (sent to issuer).")
    print("This action CANNOT be undone.")
    
    confirm = input("\nType 'YES' to proceed: ").strip()
    
    if confirm != 'YES':
        print("\nOperation cancelled.")
        return
    
    results = remove_trustlines(secret_key, keypair, public_key, trustlines, selected_indices)
    print_summary(results)

def handle_claimable_balances(keypair, public_key, action):
    """Handle claiming or rejecting claimable balances"""
    print("\nLoading claimable balances...")
    claimable_balances = load_claimable_balances(public_key)
    
    if not display_claimable_balances(claimable_balances):
        return
    
    action_text = "claim" if action == "claim" else "reject"
    
    selected_indices = None
    while selected_indices is None:
        selected_indices = get_selection(claimable_balances, f"balances to {action_text}")
    
    print("\n" + "="*50)
    print("⚠️  CONFIRMATION")
    print("="*50)
    print(f"\nYou are about to {action_text} {len(selected_indices)} claimable balance(s).")
    
    confirm = input("\nType 'YES' to proceed: ").strip()
    
    if confirm != 'YES':
        print("\nOperation cancelled.")
        return
    
    if action == "claim":
        results = claim_claimable_balances(keypair, public_key, claimable_balances, selected_indices)
    else:
        results = reject_claimable_balances(keypair, public_key, claimable_balances, selected_indices)
    
    print_summary(results)

def main():
    print("="*50)
    print("STELLAR ACCOUNT MANAGER")
    print("="*50)
    
    # Get secret key once
    secret_key = input("\nEnter your Stellar secret key (starts with 'S'): ").strip()
    
    if not secret_key.startswith('S'):
        print("Error: Invalid secret key format.")
        sys.exit(1)
    
    # Get keypair and public key
    try:
        keypair = Keypair.from_secret(secret_key)
        public_key = keypair.public_key
        print(f"\nPublic Key: {public_key}")
    except Exception as e:
        print(f"Error: Invalid secret key - {e}")
        sys.exit(1)
    
    # Main loop
    while True:
        choice = main_menu()
        
        if choice == '1':
            handle_trustlines(secret_key, keypair, public_key)
        elif choice == '2':
            handle_claimable_balances(keypair, public_key, "claim")
        elif choice == '3':
            handle_claimable_balances(keypair, public_key, "reject")
        elif choice == '4':
            print("\nExiting...")
            break
        else:
            print("\nInvalid choice. Please select 1-4.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)