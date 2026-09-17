import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";


// Navigation stack for Banking App
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import TransferScreen from "../screens/TransferScreen";
import TransactionScreen from "../screens/TransactionScreen";
import AdminScreen from "../screens/AdminScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {

    return (

        <Stack.Navigator screenOptions={{ headerShown: false }}>

            <Stack.Screen
                name="Login"
                component={LoginScreen}
            />


            <Stack.Screen
                name="Register"
                component={RegisterScreen}
            />


            <Stack.Screen
                name="Dashboard"
                component={DashboardScreen}
            />

            <Stack.Screen
                name="Transfer"
                component={TransferScreen}
            />

            <Stack.Screen
                name="Transactions"
                component={TransactionScreen}
            />

            <Stack.Screen
                name="Admin"
                component={AdminScreen}
            />

        </Stack.Navigator>

    );

}