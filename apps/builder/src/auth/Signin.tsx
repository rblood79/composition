import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAsyncMutation } from "../builder/hooks/useAsyncMutation";
import { supabase } from "../env/supabase.client";
import { TextField } from "react-aria-components/TextField";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";
import { FieldError } from "react-aria-components/FieldError";
import { Button } from "react-aria-components/Button";
import "./index.css";

interface AuthCredentials {
  email: string;
  password: string;
}

const Signin = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up mutation
  const signUpMutation = useAsyncMutation<string, AuthCredentials>(
    async ({ email, password }) => {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      return "회원가입이 완료되었습니다. 이메일을 확인해주세요.";
    },
    {
      onSuccess: () => {
        setEmail("");
        setPassword("");
      },
    },
  );

  // Sign In mutation
  const signInMutation = useAsyncMutation<void, AuthCredentials>(
    async ({ email, password }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    },
    {
      onSuccess: () => {
        navigate("/dashboard");
      },
    },
  );

  const loading = signUpMutation.isLoading || signInMutation.isLoading;
  const error = signUpMutation.error || signInMutation.error;
  const message = signUpMutation.data;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const credentials = { email, password };

    try {
      if (isSignUp) {
        await signUpMutation.execute(credentials);
      } else {
        await signInMutation.execute(credentials);
      }
    } catch (err) {
      // 에러는 mutation.error에 자동 저장됨
      console.error("[Signin] Auth failed:", err);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    signUpMutation.reset();
    signInMutation.reset();
    setEmail("");
    setPassword("");
  };

  return (
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{isSignUp ? "Sign Up" : "Sign In"}</h1>
          <p className="auth-subtitle">
            {isSignUp ? "Create a new account" : "Log in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <TextField
            className="auth-form-field"
            value={email}
            onChange={setEmail}
            isRequired={true}
            isInvalid={!!error}
            validationBehavior="aria"
          >
            <Label>Email Address</Label>
            <Input type="email" />
            {error && <FieldError>{error.message}</FieldError>}
          </TextField>

          <TextField
            className="auth-form-field"
            value={password}
            onChange={setPassword}
            isRequired={true}
          >
            <Label>Password</Label>
            <Input type="password" />
            {isSignUp && (
              <Text slot="description">
                Enter a secure password with at least 8 characters.
              </Text>
            )}
            {!isSignUp && (
              <Text slot="description">Enter your account password.</Text>
            )}
          </TextField>
          {message && (
            <div className="success-message">
              <p className="success-text">{message}</p>
            </div>
          )}

          <Button
            type="submit"
            className="react-aria-Button"
            isDisabled={loading}
            data-size="md"
            data-variant="primary"
          >
            {loading
              ? isSignUp
                ? "Signing Up..."
                : "Signing In..."
              : isSignUp
                ? "Sign Up"
                : "Sign In"}
          </Button>

          <div className="helper-text">
            <Button
              className="react-aria-Button"
              data-size="md"
              onPress={toggleMode}
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </Button>
            {!isSignUp ? (
              <Button
                className="react-aria-Button"
                data-size="md"
                onPress={() => navigate("/forgot-password")}
              >
                Forgot Password?
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
};

export default Signin;
