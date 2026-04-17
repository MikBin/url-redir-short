# Change Proposal: CSV Bulk Import Format

## Problem
The system currently only supports JSON format for bulk import of URL rules (FR-29). Users who manage links in spreadsheets must convert to JSON before importing, creating friction and potential errors.

## Opportunity
Adding CSV import support enables direct import from spreadsheet tools (Excel, Google Sheets), reducing the workflow from "export → convert → import" to "export → import".

## Success Metrics
- CSV and JSON formats both accepted by bulk import API and UI
- Clear error messages for malformed CSV rows
- CSV header validation with helpful feedback
- Zero regression in existing JSON bulk import

## Scope
- Add CSV parser to bulk import API endpoint
- Update UI bulk import modal to accept `.csv` files
- Add validation and error reporting for CSV format
- Document expected CSV column format