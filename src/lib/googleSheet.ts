// lib/googleSheet.ts

import { google } from "googleapis";

const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
);

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const getGoogleSheetsInstance = async () => {
    const client = await auth.getClient();

    return google.sheets({
        version: "v4",
        auth: client,
    });
};

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

/**
 * Read data from sheet
 */
export const readSheet = async (
    range: string = "Sheet1!A1:Z1000"
) => {
    try {
        const sheets = await getGoogleSheetsInstance();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        return response.data.values || [];
    } catch (error) {
        console.error("Read Sheet Error:", error);
        throw error;
    }
};

/**
 * Append new row
 */
export const appendSheetRow = async (
    values: (string | number)[][]
) => {
    try {
        const sheets = await getGoogleSheetsInstance();

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "Sheet1",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Append Row Error:", error);
        throw error;
    }
};

/**
 * Update existing row/cells
 */
export const updateSheetRow = async (
    range: string,
    values: (string | number)[][]
) => {
    try {
        const sheets = await getGoogleSheetsInstance();

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Update Row Error:", error);
        throw error;
    }
};

/**
 * Clear range
 */
export const clearSheetRange = async (range: string) => {
    try {
        const sheets = await getGoogleSheetsInstance();

        const response = await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
        });

        return response.data;
    } catch (error) {
        console.error("Clear Sheet Error:", error);
        throw error;
    }
};