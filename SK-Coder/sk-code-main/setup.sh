#!/bin/bash

# SK-Coder Setup Script
# Run this before deployment

echo "========================================="
echo "  SK-Coder Configuration Setup"
echo "========================================="
echo ""

# Generate JWT Secret
echo "Generating JWT_SECRET..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Generated: $JWT_SECRET"
echo ""

# Ask for password
echo "Enter ADMIN_PASSWORD (you'll use this to login):"
read -s ADMIN_PASSWORD
echo ""

# Update .env.production
echo "Updating .env.production..."
sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env.production
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env.production

echo ""
echo "========================================="
echo "  Configuration Complete!"
echo "========================================="
echo ""
echo "Username: Admin-SK"
echo "Password: <your entered password>"
echo "JWT Secret: $JWT_SECRET"
echo ""
echo "Save these credentials in a safe place!"
echo ""
echo "Next step: Run ./DEPLOY_TO_ORACLE.sh"
echo ""
